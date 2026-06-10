"use client";

import { useAuth, UserRole } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLang } from "@/context/LanguageContext";

/* ── Types ──────────────────────────────────────────────────────────────── */
interface RegisteredUser {
    email: string;
    passwordHash: string;  // ← bcrypt hash, NEVER plain text
    username: string;
    role: UserRole;
    phone?: string;
    state?: string;
    district?: string;
    pincode?: string;
    idType?: string;
    idHash?: string;       // ← SHA-256 hash of idNumber, NEVER plain text
    dob?: string;          // ← Date of Birth (YYYY-MM-DD)
    /* authority fields */
    authorityRole?: string;
    serviceId?: string;
}

const DEMO_EMAILS = ["user@demo.com", "authority@demo.com", "chief@demo.com"];

/* ── Age calculation helper ─────────────────────────────────────────────── */
function calculateAge(dob: string): number {
    const birth = new Date(dob);
    if (isNaN(birth.getTime())) return 0;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
    return age;
}

/* ── Districts by state (all 36 states / UTs of India) ─────────────────── */
const DISTRICTS_BY_STATE: Record<string, string[]> = {
    "Andhra Pradesh": ["Alluri Sitharama Raju", "Anakapalli", "Ananthapuramu", "Annamayya", "Bapatla", "Chittoor", "East Godavari", "Eluru", "Guntur", "Kadapa", "Kakinada", "Konaseema", "Krishna", "Kurnool", "Manyam", "NTR", "Nandyal", "Nellore", "Palnadu", "Prakasam", "Sri Sathya Sai", "Srikakulam", "Tirupati", "Visakhapatnam", "Vizianagaram", "West Godavari"],
    "Arunachal Pradesh": ["Anjaw", "Changlang", "Dibang Valley", "East Kameng", "East Siang", "Kamle", "Kra Daadi", "Kurung Kumey", "Lepa Rada", "Lohit", "Longding", "Lower Dibang Valley", "Lower Siang", "Lower Subansiri", "Namsai", "Pakke-Kessang", "Papum Pare", "Shi Yomi", "Siang", "Tawang", "Tirap", "Upper Dibang Valley", "Upper Siang", "Upper Subansiri", "West Kameng", "West Siang"],
    "Assam": ["Bajali", "Barpeta", "Biswanath", "Bongaigaon", "Cachar", "Charaideo", "Chirang", "Darrang", "Dhemaji", "Dhubri", "Dibrugarh", "Dima Hasao", "Goalpara", "Golaghat", "Hailakandi", "Hojai", "Jorhat", "Kamrup", "Kamrup Metropolitan", "Karbi Anglong", "Karimganj", "Kokrajhar", "Lakhimpur", "Majuli", "Morigaon", "Nagaon", "Nalbari", "Sivasagar", "Sonitpur", "South Salmara-Mankachar", "Tamulpur", "Tinsukia", "Udalguri", "West Karbi Anglong"],
    "Bihar": ["Araria", "Arwal", "Aurangabad", "Banka", "Begusarai", "Bhagalpur", "Bhojpur", "Buxar", "Darbhanga", "East Champaran", "Gaya", "Gopalganj", "Jamui", "Jehanabad", "Kaimur", "Katihar", "Khagaria", "Kishanganj", "Lakhisarai", "Madhepura", "Madhubani", "Munger", "Muzaffarpur", "Nalanda", "Nawada", "Patna", "Purnia", "Rohtas", "Saharsa", "Samastipur", "Saran", "Sheikhpura", "Sheohar", "Sitamarhi", "Siwan", "Supaul", "Vaishali", "West Champaran"],
    "Chhattisgarh": ["Balod", "Baloda Bazar", "Balrampur", "Bastar", "Bemetara", "Bijapur", "Bilaspur", "Dantewada", "Dhamtari", "Durg", "Gariaband", "Gaurela-Pendra-Marwahi", "Janjgir-Champa", "Jashpur", "Kabirdham", "Kanker", "Khairagarh", "Kondagaon", "Korba", "Koriya", "Mahasamund", "Manendragarh", "Mohla-Manpur", "Mungeli", "Narayanpur", "Raigarh", "Raipur", "Rajnandgaon", "Sarangarh-Bilaigarh", "Sakti", "Sukma", "Surajpur", "Surguja"],
    "Goa": ["North Goa", "South Goa"],
    "Gujarat": ["Ahmedabad", "Amreli", "Anand", "Aravalli", "Banaskantha", "Bharuch", "Bhavnagar", "Botad", "Chhota Udaipur", "Dahod", "Dang", "Devbhoomi Dwarka", "Gandhinagar", "Gir Somnath", "Jamnagar", "Junagadh", "Kheda", "Kutch", "Mahisagar", "Mehsana", "Morbi", "Narmada", "Navsari", "Panchmahal", "Patan", "Porbandar", "Rajkot", "Sabarkantha", "Surat", "Surendranagar", "Tapi", "Vadodara", "Valsad"],
    "Haryana": ["Ambala", "Bhiwani", "Charkhi Dadri", "Faridabad", "Fatehabad", "Gurugram", "Hisar", "Jhajjar", "Jind", "Kaithal", "Karnal", "Kurukshetra", "Mahendragarh", "Nuh", "Palwal", "Panchkula", "Panipat", "Rewari", "Rohtak", "Sirsa", "Sonipat", "Yamunanagar"],
    "Himachal Pradesh": ["Bilaspur", "Chamba", "Hamirpur", "Kangra", "Kinnaur", "Kullu", "Lahaul & Spiti", "Mandi", "Shimla", "Sirmaur", "Solan", "Una"],
    "Jharkhand": ["Bokaro", "Chatra", "Deoghar", "Dhanbad", "Dumka", "East Singhbhum", "Garhwa", "Giridih", "Godda", "Gumla", "Hazaribagh", "Jamtara", "Khunti", "Koderma", "Latehar", "Lohardaga", "Pakur", "Palamu", "Ramgarh", "Ranchi", "Sahebganj", "Seraikela-Kharsawan", "Simdega", "West Singhbhum"],
    "Karnataka": ["Bagalkot", "Ballari", "Belagavi", "Bengaluru Rural", "Bengaluru Urban", "Bidar", "Chamarajanagar", "Chikkaballapur", "Chikkamagaluru", "Chitradurga", "Dakshina Kannada", "Davangere", "Dharwad", "Gadag", "Hassan", "Haveri", "Kalaburagi", "Kodagu", "Kolar", "Koppal", "Mandya", "Mysuru", "Raichur", "Ramanagara", "Shivamogga", "Tumakuru", "Udupi", "Uttara Kannada", "Vijayanagara", "Vijayapura", "Yadgir"],
    "Kerala": ["Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kollam", "Kottayam", "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta", "Thiruvananthapuram", "Thrissur", "Wayanad"],
    "Madhya Pradesh": ["Agar Malwa", "Alirajpur", "Anuppur", "Ashoknagar", "Balaghat", "Barwani", "Betul", "Bhind", "Bhopal", "Burhanpur", "Chhatarpur", "Chhindwara", "Damoh", "Datia", "Dewas", "Dhar", "Dindori", "Guna", "Gwalior", "Harda", "Hoshangabad", "Indore", "Jabalpur", "Jhabua", "Katni", "Khandwa", "Khargone", "Maihar", "Mandla", "Mandsaur", "Mauganj", "Morena", "Narsinghpur", "Niwari", "Pandhurna", "Panna", "Raisen", "Rajgarh", "Ratlam", "Rewa", "Sagar", "Satna", "Sehore", "Seoni", "Shahdol", "Shajapur", "Sheopur", "Shivpuri", "Sidhi", "Singrauli", "Tikamgarh", "Ujjain", "Umaria", "Vidisha"],
    "Maharashtra": ["Ahmednagar", "Akola", "Amravati", "Aurangabad", "Beed", "Bhandara", "Buldhana", "Chandrapur", "Dhule", "Gadchiroli", "Gondia", "Hingoli", "Jalgaon", "Jalna", "Kolhapur", "Latur", "Mumbai City", "Mumbai Suburban", "Nagpur", "Nanded", "Nandurbar", "Nashik", "Osmanabad", "Palghar", "Parbhani", "Pune", "Raigad", "Ratnagiri", "Sangli", "Satara", "Sindhudurg", "Solapur", "Thane", "Wardha", "Washim", "Yavatmal"],
    "Manipur": ["Bishnupur", "Chandel", "Churachandpur", "Imphal East", "Imphal West", "Jiribam", "Kakching", "Kamjong", "Kangpokpi", "Noney", "Pherzawl", "Senapati", "Tamenglong", "Tengnoupal", "Thoubal", "Ukhrul"],
    "Meghalaya": ["East Garo Hills", "East Jaintia Hills", "East Khasi Hills", "Eastern West Khasi Hills", "North Garo Hills", "Ri-Bhoi", "South Garo Hills", "South West Garo Hills", "South West Khasi Hills", "West Garo Hills", "West Jaintia Hills", "West Khasi Hills"],
    "Mizoram": ["Aizawl", "Champhai", "Hnahthial", "Khawzawl", "Kolasib", "Lawngtlai", "Lunglei", "Mamit", "Saitual", "Serchhip", "Siaha"],
    "Nagaland": ["Chumoukedima", "Dimapur", "Kiphire", "Kohima", "Longleng", "Mokokchung", "Mon", "Noklak", "Peren", "Phek", "Shamator", "Tseminyu", "Tuensang", "Wokha", "Zunheboto"],
    "Odisha": ["Angul", "Balangir", "Balasore", "Bargarh", "Bhadrak", "Boudh", "Cuttack", "Deogarh", "Dhenkanal", "Gajapati", "Ganjam", "Jagatsinghpur", "Jajpur", "Jharsuguda", "Kalahandi", "Kandhamal", "Kendrapara", "Kendujhar", "Khordha", "Koraput", "Malkangiri", "Mayurbhanj", "Nabarangpur", "Nayagarh", "Nuapada", "Puri", "Rayagada", "Sambalpur", "Sonepur", "Sundargarh"],
    "Punjab": ["Amritsar", "Barnala", "Bathinda", "Faridkot", "Fatehgarh Sahib", "Fazilka", "Ferozepur", "Gurdaspur", "Hoshiarpur", "Jalandhar", "Kapurthala", "Ludhiana", "Malerkotla", "Mansa", "Moga", "Mohali", "Muktsar", "Nawanshahr", "Pathankot", "Patiala", "Rupnagar", "Sangrur", "Tarn Taran"],
    "Rajasthan": ["Ajmer", "Alwar", "Anupgarh", "Balotra", "Banswara", "Baran", "Barmer", "Beawar", "Bharatpur", "Bhilwara", "Bikaner", "Bundi", "Chittorgarh", "Churu", "Dausa", "Deeg", "Dholpur", "Didwana-Kuchaman", "Dudu", "Dungarpur", "Gangapur City", "Hanumangarh", "Jaipur", "Jaipur Rural", "Jaisalmer", "Jalore", "Jhalawar", "Jhunjhunu", "Jodhpur", "Jodhpur Rural", "Karauli", "Kekri", "Khairthal-Tijara", "Kotputli-Behror", "Kota", "Nagaur", "Neem Ka Thana", "Pali", "Phalodi", "Pratapgarh", "Rajsamand", "Salumbar", "Sanchore", "Sawai Madhopur", "Shahpura", "Sikar", "Sirohi", "Sri Ganganagar", "Tonk", "Udaipur"],
    "Sikkim": ["East Sikkim", "North Sikkim", "Pakyong", "Soreng", "South Sikkim", "West Sikkim"],
    "Tamil Nadu": ["Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kancheepuram", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai", "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai", "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli", "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram", "Virudhunagar"],
    "Telangana": ["Adilabad", "Bhadradri Kothagudem", "Hanumakonda", "Hyderabad", "Jagtial", "Jangaon", "Jayashankar Bhupalpally", "Jogulamba Gadwal", "Kamareddy", "Karimnagar", "Khammam", "Kumuram Bheem", "Mahabubabad", "Mahbubnagar", "Mancherial", "Medak", "Medchal-Malkajgiri", "Mulugu", "Nagarkurnool", "Nalgonda", "Narayanpet", "Nirmal", "Nizamabad", "Peddapalli", "Rajanna Sircilla", "Rangareddy", "Sangareddy", "Siddipet", "Suryapet", "Vikarabad", "Wanaparthy", "Warangal", "Yadadri Bhuvanagiri"],
    "Tripura": ["Dhalai", "Gomati", "Khowai", "North Tripura", "Sepahijala", "Sipahijala", "South Tripura", "Unakoti", "West Tripura"],
    "Uttar Pradesh": ["Agra", "Aligarh", "Ambedkar Nagar", "Amethi", "Amroha", "Auraiya", "Ayodhya", "Azamgarh", "Baghpat", "Bahraich", "Ballia", "Balrampur", "Banda", "Barabanki", "Bareilly", "Basti", "Bijnor", "Budaun", "Bulandshahr", "Chandauli", "Chitrakoot", "Deoria", "Etah", "Etawah", "Farrukhabad", "Fatehpur", "Firozabad", "Gautam Buddha Nagar", "Ghaziabad", "Ghazipur", "Gonda", "Gorakhpur", "Hamirpur", "Hapur", "Hardoi", "Hathras", "Jalaun", "Jaunpur", "Jhansi", "Kannauj", "Kanpur Dehat", "Kanpur Nagar", "Kasganj", "Kaushambi", "Kushinagar", "Lakhimpur Kheri", "Lalitpur", "Lucknow", "Mahoba", "Maharajganj", "Mainpuri", "Mathura", "Mau", "Meerut", "Mirzapur", "Moradabad", "Muzaffarnagar", "Pilibhit", "Pratapgarh", "Prayagraj", "Rae Bareli", "Rampur", "Saharanpur", "Sambhal", "Sant Kabir Nagar", "Sant Ravidas Nagar", "Shahjahanpur", "Shamli", "Shrawasti", "Siddharthnagar", "Sitapur", "Sonbhadra", "Sultanpur", "Unnao", "Varanasi"],
    "Uttarakhand": ["Almora", "Bageshwar", "Chamoli", "Champawat", "Dehradun", "Haridwar", "Nainital", "Pauri Garhwal", "Pithoragarh", "Rudraprayag", "Tehri Garhwal", "Udham Singh Nagar", "Uttarkashi"],
    "West Bengal": ["Alipurduar", "Bankura", "Birbhum", "Cooch Behar", "Dakshin Dinajpur", "Darjeeling", "Hooghly", "Howrah", "Jalpaiguri", "Jhargram", "Kalimpong", "Kolkata", "Malda", "Murshidabad", "Nadia", "North 24 Parganas", "Paschim Bardhaman", "Paschim Medinipur", "Purba Bardhaman", "Purba Medinipur", "Purulia", "South 24 Parganas", "Uttar Dinajpur"],
    "Andaman & Nicobar Islands": ["Nicobar", "North & Middle Andaman", "South Andaman"],
    "Chandigarh": ["Chandigarh"],
    "Dadra & Nagar Haveli": ["Dadra & Nagar Haveli"],
    "Daman & Diu": ["Daman", "Diu"],
    "Delhi": ["Central Delhi", "East Delhi", "New Delhi", "North Delhi", "North East Delhi", "North West Delhi", "Shahdara", "South Delhi", "South East Delhi", "South West Delhi", "West Delhi"],
    "Jammu & Kashmir": ["Anantnag", "Bandipora", "Baramulla", "Budgam", "Doda", "Ganderbal", "Jammu", "Kathua", "Kishtwar", "Kulgam", "Kupwara", "Poonch", "Pulwama", "Rajouri", "Ramban", "Reasi", "Samba", "Shopian", "Srinagar", "Udhampur"],
    "Ladakh": ["Kargil", "Leh"],
    "Lakshadweep": ["Lakshadweep"],
    "Puducherry": ["Karaikal", "Mahe", "Puducherry", "Yanam"],
};

const INDIAN_STATES = Object.keys(DISTRICTS_BY_STATE).sort();

/* ── Verhoeff checksum tables (same algorithm UIDAI uses for Aadhaar) ──────── */
const VERHOEFF_D = [
    [0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],
    [3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],
    [6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],
    [9,8,7,6,5,4,3,2,1,0],
];
const VERHOEFF_P = [
    [0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],
    [8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],
    [2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8],
];
const VERHOEFF_INV = [0,4,3,2,1,9,8,7,6,5];
function verhoeffCheck(num: string): boolean {
    let c = 0;
    const digits = num.split("").reverse().map(Number);
    for (let i = 0; i < digits.length; i++) {
        c = VERHOEFF_D[c][VERHOEFF_P[i % 8][digits[i]]];
    }
    return c === 0;
}

/* ── Aadhaar validation (Verhoeff checksum — same algorithm UIDAI uses) ─── */
function validateAadhaar(value: string): string {
    const v = value.trim().replace(/\s+/g, "");
    if (!/^\d{12}$/.test(v))       return "Aadhaar must be exactly 12 digits.";
    if (v[0] === "0" || v[0] === "1") return "Aadhaar number cannot start with 0 or 1.";
    if (!verhoeffCheck(v))          return "Invalid Aadhaar number (checksum failed). Please double-check.";
    return "";
}

/* ── Shared input style ─────────────────────────────────────────────────── */
const inputStyle = (error?: boolean): React.CSSProperties => ({
    width: "100%", padding: "0.75rem 1rem", borderRadius: "0.75rem",
    border: `1.5px solid ${error ? "#ef4444" : "var(--border)"}`,
    background: "var(--bg-card)", color: "var(--text-main)",
    fontFamily: "inherit", fontSize: "0.9rem", transition: "var(--transition)",
    boxSizing: "border-box",
});

/* ── Aadhaar is the only accepted ID (strongest govt-grade validation) ──── */

/* ── Reusable field wrapper (defined OUTSIDE component to prevent remount) ─ */
function Field({ label, icon, error, children }: { label: string; icon: string; error?: string; children: React.ReactNode }) {
    return (
        <div>
            <label style={{ display: "block", marginBottom: "0.35rem", fontWeight: "600", fontSize: "0.82rem", color: "var(--text-main)" }}>
                {icon} {label}
            </label>
            {children}
            {error && <p style={{ fontSize: "0.7rem", color: "#ef4444", marginTop: "0.3rem", fontWeight: "600" }}>⚠️ {error}</p>}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Component
═══════════════════════════════════════════════════════════════════════════ */
export default function LoginPage() {
    const { login } = useAuth();
    const router = useRouter();
    const { t } = useLang();

    const ROLE_CONFIG = {
        user: {
            label: t("login_citizen_label"), icon: "👤",
            description: t("login_citizen_desc"), color: "#6366f1",
            gradient: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            hint: "user@demo.com / user123",
            demoEmail: "user@demo.com", demoPassword: "user123",
        },
        authority: {
            label: t("login_authority_label"), icon: "🏛️",
            description: t("login_authority_desc"), color: "#f97316",
            gradient: "linear-gradient(135deg, #f97316, #fb923c)",
            hint: "authority@demo.com / auth123",
            demoEmail: "authority@demo.com", demoPassword: "auth123",
        },
        chief: {
            label: t("login_chief_label"), icon: "⭐",
            description: t("login_chief_desc"), color: "#ec4899",
            gradient: "linear-gradient(135deg, #ec4899, #f43f5e)",
            hint: "chief@demo.com / chief123",
            demoEmail: "chief@demo.com", demoPassword: "chief123",
        },
    };

    // Demo mode: set NEXT_PUBLIC_DEMO_MODE=false in Vercel env to hide demo hints on production
    const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";

    /* ── Login state ── */
    const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loginError, setLoginError] = useState("");
    const [loginLoading, setLoginLoading] = useState(false);

    /* ── Mode ── */
    const [mode, setMode] = useState<"login" | "signup" | "auth-signup" | "chief-signup">("login");

    /* ── Sign-up state ── */
    const [su, setSu] = useState({
        name: "", email: "", phone: "",
        dob: "",                              // Date of Birth
        idType: "aadhaar", idNumber: "",
        state: "", district: "", pincode: "",
        password: "", confirm: "",
        otpToken: "",
    });
    const [showSuPw, setShowSuPw] = useState(false);
    const [suErrors, setSuErrors] = useState<Record<string, string>>({});
    const [suLoading, setSuLoading] = useState(false);
    const [suSuccess, setSuSuccess] = useState(false);
    /* OTP state for citizen signup */
    const [otpSent, setOtpSent] = useState(false);
    const [otpValue, setOtpValue] = useState("");
    const [otpVerified, setOtpVerified] = useState(false);
    const [otpLoading, setOtpLoading] = useState(false);
    const [otpError, setOtpError] = useState("");
    const [otpCooldown, setOtpCooldown] = useState(0);

    /* ── Authority sign-up state ── */
    const [au, setAu] = useState({
        name: "", email: "", phone: "",
        authorityRole: "", serviceId: "",
        workingPlace: "", state: "", district: "",
        password: "", confirm: "",
    });
    const [showAuPw, setShowAuPw] = useState(false);
    const [auErrors, setAuErrors] = useState<Record<string, string>>({});
    const [auLoading, setAuLoading] = useState(false);
    const [auSuccess, setAuSuccess] = useState(false);

    /* ── Chief sign-up state ── */
    const [ch, setCh] = useState({
        name: "", email: "", phone: "",
        officerId: "",
        password: "", confirm: "",
    });
    const [showChPw, setShowChPw] = useState(false);
    const [chErrors, setChErrors] = useState<Record<string, string>>({});
    const [chLoading, setChLoading] = useState(false);
    const [chSuccess, setChSuccess] = useState(false);
    const setChField = (key: string, value: string) => {
        setCh(prev => ({ ...prev, [key]: value }));
        if (chErrors[key]) setChErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
    };

    /* ── Login handler — calls server API (bcrypt compare) ── */
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRole) { setLoginError(t("login_error_role")); return; }
        setLoginLoading(true); setLoginError("");
        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    password,
                    role: selectedRole,
                }),
            });
            const data = await res.json();
            if (data.success && data.user) {
                login({ username: data.user.username, email: data.user.email, role: data.user.role as UserRole });
                if (data.user.role === "user") router.push("/");
                else if (data.user.role === "authority") router.push("/admin");
                else router.push("/chief");
            } else {
                setLoginError(t("login_error_creds"));
            }
        } catch {
            setLoginError("Connection error. Please try again.");
        }
        setLoginLoading(false);
    };

    const fillDemo = () => {
        if (!selectedRole) return;
        setEmail(ROLE_CONFIG[selectedRole].demoEmail);
        setPassword(ROLE_CONFIG[selectedRole].demoPassword);
        setLoginError("");
    };

    /* ── Sign-up field change ── */
    const setSuField = (key: string, value: string) => {
        setSu(prev => {
            const next = { ...prev, [key]: value };
            if (key === "email") {
                next.otpToken = "";
                setOtpVerified(false);
                setOtpSent(false);
                setOtpValue("");
                setOtpError("");
            }
            return next;
        });
        if (suErrors[key]) setSuErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
    };
    const setAuField = (key: string, value: string) => {
        setAu(prev => ({ ...prev, [key]: value }));
        if (auErrors[key]) setAuErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
    };

    /* ── Sign-up validation ── */
    const validateSignup = (): boolean => {
        const errs: Record<string, string> = {};
        if (!su.name.trim()) errs.name = "Full name is required.";
        if (!su.email.includes("@")) errs.email = "Enter a valid email address.";
        if (!/^\d{10}$/.test(su.phone)) errs.phone = "Enter a valid 10-digit mobile number.";
        /* ── DOB + 18+ check (client-side; server also enforces this) ── */
        if (!su.dob) errs.dob = "Date of birth is required.";
        else if (calculateAge(su.dob) < 18)
            errs.dob = "You must be 18 years or older to register.";
        /* ── Aadhaar (only accepted ID) ── */
        if (su.idNumber.trim() === "") errs.idNumber = "Aadhaar number is required.";
        else { const idErr = validateAadhaar(su.idNumber); if (idErr) errs.idNumber = idErr; }
        if (!su.state) errs.state = "Please select your state.";
        if (!su.district.trim()) errs.district = "District name is required.";
        if (!/^\d{6}$/.test(su.pincode)) errs.pincode = "Enter a valid 6-digit pincode.";
        if (su.password.length < 8) errs.password = "Password must be at least 8 characters.";
        else if (!/[A-Z]/.test(su.password)) errs.password = "Password must contain at least one uppercase letter.";
        else if (!/[^A-Za-z0-9]/.test(su.password)) errs.password = "Password must contain at least one special character (!@#$…).";
        if (su.password !== su.confirm) errs.confirm = "Passwords do not match.";
        setSuErrors(errs);
        return Object.keys(errs).length === 0;
    };

    /* ── Authority sign-up validation ── */
    const validateAuthSignup = (): boolean => {
        const errs: Record<string, string> = {};
        if (!au.name.trim()) errs.name = "Full name is required.";
        if (!au.email.includes("@")) errs.email = "Enter a valid email address.";
        if (!/^\d{10}$/.test(au.phone)) errs.phone = "Enter a valid 10-digit phone number.";
        if (!au.authorityRole) errs.authorityRole = "Please select your authority role.";
        if (!au.serviceId.trim()) errs.serviceId = "Service Card ID is required.";
        else if (au.serviceId.trim().length < 5) errs.serviceId = "Service Card ID must be at least 5 characters.";
        if (!au.workingPlace.trim()) errs.workingPlace = "Working place / office name is required.";
        if (!au.state) errs.state = "Please select your state.";
        if (!au.district.trim()) errs.district = "District name is required.";
        if (au.password.length < 8) errs.password = "Password must be at least 8 characters.";
        else if (!/[A-Z]/.test(au.password)) errs.password = "Password must contain at least one uppercase letter.";
        else if (!/[^A-Za-z0-9]/.test(au.password)) errs.password = "Password must contain at least one special character.";
        if (au.password !== au.confirm) errs.confirm = "Passwords do not match.";
        setAuErrors(errs);
        return Object.keys(errs).length === 0;
    };

    /* ── OTP: Send ── */
    const sendOtp = async () => {
        if (!su.email.includes("@")) { setOtpError("Enter a valid email first."); return; }
        setOtpLoading(true); setOtpError("");
        try {
            const res = await fetch("/api/auth/otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: su.email, action: "send" }),
            });
            const data = await res.json();
            if (data.success) {
                setOtpSent(true);
                setOtpCooldown(60);
                if (data.devMode && data.otp) {
                    setOtpValue(data.otp);
                    setOtpError(`Dev mode: OTP pre-filled (${data.otp}). Resend not configured.`);
                }
                let t = 60;
                const interval = setInterval(() => { t--; setOtpCooldown(t); if (t <= 0) clearInterval(interval); }, 1000);
            } else {
                setOtpError(data.error || "Failed to send OTP.");
            }
        } catch { setOtpError("Connection error. Try again."); }
        setOtpLoading(false);
    };

    /* ── OTP: Verify ── */
    const verifyOtp = async () => {
        if (!otpValue.trim()) { setOtpError("Please enter the OTP."); return; }
        setOtpLoading(true); setOtpError("");
        try {
            const res = await fetch("/api/auth/otp", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: su.email, otp: otpValue.trim() }),
            });
            const data = await res.json();
            if (data.success) {
                setOtpVerified(true); setOtpError("");
                setSu(prev => ({ ...prev, otpToken: data.verificationToken || "" }));
                setSuErrors(prev => { const n = {...prev}; delete n.otp; return n; });
            } else {
                setOtpError(data.error || "Invalid OTP.");
            }
        } catch { setOtpError("Connection error. Try again."); }
        setOtpLoading(false);
    };

    /* ── Citizen Sign-up — requires email OTP first ── */
    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!otpVerified) { setSuErrors({ otp: "Please verify your email with the OTP before registering." }); return; }
        if (!validateSignup()) return;
        setSuLoading(true);
        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: su.email, password: su.password,
                    username: su.name.trim(), role: "user",
                    phone: su.phone, state: su.state,
                    district: su.district, pincode: su.pincode,
                    idType: su.idType,
                    idNumber: su.idNumber.trim().toUpperCase(), // server hashes & discards plain text
                    dob: su.dob,
                    otpToken: su.otpToken,
                }),
            });
            const data = await res.json();
            if (data.success && data.user) {
                setSuSuccess(true);
                setTimeout(() => {
                    setMode("login"); setSelectedRole("user"); setEmail(su.email); setPassword("");
                    setSu({ name: "", email: "", phone: "", dob: "", idType: "aadhaar", idNumber: "", state: "", district: "", pincode: "", password: "", confirm: "", otpToken: "" });
                    setSuErrors({}); setSuSuccess(false);
                }, 1800);
            } else {
                // Map server field-specific errors to the correct form field
                if (data.field === "dob") setSuErrors({ dob: data.error });
                else if (data.field === "idNumber") setSuErrors({ idNumber: data.error });
                else setSuErrors({ email: data.error || "Registration failed. Please try again." });
            }
        } catch {
            setSuErrors({ email: "Connection error. Please try again." });
        }
        setSuLoading(false);
    };

    const handleAuthSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateAuthSignup()) return;
        setAuLoading(true);
        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: au.email,
                    password: au.password,
                    username: au.name.trim(),
                    role: "authority",
                    phone: au.phone,
                    authorityRole: au.authorityRole,
                    serviceId: au.serviceId.trim(),
                }),
            });
            const data = await res.json();
            if (data.success && data.user) {
                setAuSuccess(true);
                setTimeout(() => {
                    setMode("login"); setSelectedRole("authority"); setEmail(au.email); setPassword("");
                    setAu({ name: "", email: "", phone: "", authorityRole: "", serviceId: "", workingPlace: "", state: "", district: "", password: "", confirm: "" });
                    setAuErrors({}); setAuSuccess(false);
                }, 1800);
            } else {
                setAuErrors({ email: data.error || "Registration failed. Please try again." });
            }
        } catch {
            setAuErrors({ email: "Connection error. Please try again." });
        }
        setAuLoading(false);
    };

    /* ── Chief sign-up validation + handler ── */
    const validateChiefSignup = (): boolean => {
        const errs: Record<string, string> = {};
        if (!ch.name.trim()) errs.name = "Full name is required.";
        if (!ch.email.includes("@")) errs.email = "Enter a valid email address.";
        if (!/^\d{10}$/.test(ch.phone)) errs.phone = "Enter a valid 10-digit phone number.";
        if (!ch.officerId.trim()) errs.officerId = "Officer ID is required.";
        else if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9\-]{6,20}$/.test(ch.officerId.trim()))
            errs.officerId = "Must be 6\u201320 chars with both letters and digits (e.g. CHIEF-2024-001).";
        if (ch.password.length < 8) errs.password = "Password must be at least 8 characters.";
        else if (!/[A-Z]/.test(ch.password)) errs.password = "Password must contain at least one uppercase letter.";
        else if (!/[^A-Za-z0-9]/.test(ch.password)) errs.password = "Password must contain at least one special character.";
        if (ch.password !== ch.confirm) errs.confirm = "Passwords do not match.";
        setChErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleChiefSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateChiefSignup()) return;
        setChLoading(true);
        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: ch.email,
                    password: ch.password,
                    username: ch.name.trim(),
                    role: "chief",
                    phone: ch.phone,
                    serviceId: ch.officerId.trim().toUpperCase(),
                }),
            });
            const data = await res.json();
            if (data.success && data.user) {
                setChSuccess(true);
                setTimeout(() => {
                    setMode("login"); setSelectedRole("chief"); setEmail(ch.email); setPassword("");
                    setCh({ name: "", email: "", phone: "", officerId: "", password: "", confirm: "" });
                    setChErrors({}); setChSuccess(false);
                }, 1800);
            } else {
                setChErrors({ email: data.error || "Registration failed. Please try again." });
            }
        } catch {
            setChErrors({ email: "Connection error. Please try again." });
        }
        setChLoading(false);
    };

    const switchMode = (m: "login" | "signup" | "auth-signup" | "chief-signup") => {
        setMode(m); setLoginError(""); setSuErrors({}); setSuSuccess(false); setAuErrors({}); setAuSuccess(false); setChErrors({}); setChSuccess(false);
    };

    const cfg = selectedRole ? ROLE_CONFIG[selectedRole] : null;
    const pwHasLen = su.password.length >= 8;
    const pwHasUpper = /[A-Z]/.test(su.password);
    const pwHasSpecial = /[^A-Za-z0-9]/.test(su.password);
    const pwScore = [pwHasLen, pwHasUpper, pwHasSpecial].filter(Boolean).length;
    const pwStrength = su.password.length === 0 ? null : pwScore === 1 ? "Weak" : pwScore === 2 ? "Good" : "Strong";
    const pwColor = pwStrength === "Weak" ? "#ef4444" : pwStrength === "Good" ? "#f59e0b" : "#10b981";

    const auPwHasLen = au.password.length >= 8;
    const auPwHasUpper = /[A-Z]/.test(au.password);
    const auPwHasSpecial = /[^A-Za-z0-9]/.test(au.password);
    const auPwScore = [auPwHasLen, auPwHasUpper, auPwHasSpecial].filter(Boolean).length;
    const auPwStrength = au.password.length === 0 ? null : auPwScore === 1 ? "Weak" : auPwScore === 2 ? "Good" : "Strong";
    const auPwColor = auPwStrength === "Weak" ? "#ef4444" : auPwStrength === "Good" ? "#f59e0b" : "#10b981";

    const chPwHasLen = ch.password.length >= 8;
    const chPwHasUpper = /[A-Z]/.test(ch.password);
    const chPwHasSpecial = /[^A-Za-z0-9]/.test(ch.password);
    const chPwScore = [chPwHasLen, chPwHasUpper, chPwHasSpecial].filter(Boolean).length;
    const chPwStrength = ch.password.length === 0 ? null : chPwScore === 1 ? "Weak" : chPwScore === 2 ? "Good" : "Strong";
    const chPwColor = chPwStrength === "Weak" ? "#ef4444" : chPwStrength === "Good" ? "#f59e0b" : "#10b981";



    /* ════════════════════════════════════════════════════════ JSX ══ */
    return (
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem", position: "relative", overflow: "hidden" }}>

            {/* ── Blobs ── */}
            <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
                <div style={{ position: "absolute", top: "-10%", left: "-5%", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)", animation: "blobDrift 12s ease-in-out infinite" }} />
                <div style={{ position: "absolute", bottom: "-10%", right: "-5%", width: "420px", height: "420px", borderRadius: "50%", background: "radial-gradient(circle, rgba(236,72,153,0.15) 0%, transparent 70%)", animation: "blobDrift 16s ease-in-out infinite reverse" }} />
                <div style={{ position: "absolute", top: "40%", right: "10%", width: "280px", height: "280px", borderRadius: "50%", background: "radial-gradient(circle, rgba(245,158,11,0.1) 0%, transparent 70%)", animation: "blobDrift 20s ease-in-out infinite", animationDelay: "-5s" }} />
            </div>

            <div className="animate-slide-up" style={{ width: "100%", maxWidth: "540px", position: "relative", zIndex: 1 }}>

                {/* ── Brand header ── */}
                <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "72px", height: "72px", borderRadius: "20px", background: "var(--grad-primary)", fontSize: "2rem", marginBottom: "1.25rem", boxShadow: "0 8px 32px var(--primary-glow)", animation: "float 5s ease-in-out infinite" }}>⚖️</div>
                    <h1 style={{ fontSize: "2.1rem", marginBottom: "0.5rem" }}>
                        {t("login_welcome")} <span className="gradient-text">AI Grievance</span>
                    </h1>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>{t("login_select_role")}</p>
                </div>

                {/* ── Role selector ── */}
                <div className="stagger-children" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "2rem" }}>
                    {(Object.entries(ROLE_CONFIG) as [UserRole, typeof ROLE_CONFIG.user][]).map(([role, config]) => {
                        const isSelected = selectedRole === role;
                        return (
                            <button key={role} type="button"
                                onClick={() => { setSelectedRole(role); setEmail(""); setPassword(""); setLoginError(""); setShowPassword(false); if (mode === "signup" && role !== "user") setMode("login"); }}
                                className="glass animate-fade-in"
                                style={{ padding: "1.25rem 0.6rem", borderRadius: "var(--radius)", border: isSelected ? `2px solid ${config.color}` : "2px solid transparent", cursor: "pointer", textAlign: "center", background: isSelected ? `${config.color}15` : undefined, transition: "var(--transition)", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", boxShadow: isSelected ? `0 0 0 4px ${config.color}25, var(--shadow-md)` : "var(--shadow-sm)", transform: isSelected ? "translateY(-3px) scale(1.03)" : "translateY(0) scale(1)" }}
                            >
                                <span style={{ fontSize: "1.9rem", lineHeight: 1, filter: isSelected ? `drop-shadow(0 0 8px ${config.color}88)` : "none", transition: "filter 0.3s ease", display: "block" }}>{config.icon}</span>
                                <span style={{ fontWeight: "700", fontSize: "0.78rem", color: isSelected ? config.color : "var(--text-main)" }}>{config.label}</span>
                                <span style={{ fontSize: "0.62rem", color: "var(--text-muted)", lineHeight: 1.35, textAlign: "center" }}>{config.description}</span>
                                {isSelected && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: config.color, boxShadow: `0 0 6px ${config.color}`, animation: "glowPulse 1.5s ease-in-out infinite" }} />}
                            </button>
                        );
                    })}
                </div>

                {/* ══════════ LOGIN FORM ══════════ */}
                {mode === "login" && selectedRole && cfg && (
                    <div className="glass animate-slide-up" style={{ padding: "2rem", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)" }}>
                        {/* Header row */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: cfg.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem", boxShadow: `0 4px 12px ${cfg.color}44` }}>{cfg.icon}</div>
                                <div>
                                    <div style={{ fontWeight: "700", fontSize: "0.95rem" }}>{cfg.label} Login</div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                        {DEMO_MODE ? "Secure demo access" : "Secure access"}
                                    </div>
                                </div>
                            </div>
                            {DEMO_MODE && (
                                <button type="button" onClick={fillDemo}
                                    style={{ padding: "0.35rem 0.85rem", borderRadius: "99px", fontSize: "0.72rem", fontWeight: "700", background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}40`, cursor: "pointer", transition: "var(--transition)" }}
                                    onMouseEnter={e => { e.currentTarget.style.background = `${cfg.color}30`; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = `${cfg.color}18`; }}
                                >⚡ Fill Demo</button>
                            )}
                        </div>

                        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
                            <div>
                                <label style={{ display: "block", marginBottom: "0.4rem", fontWeight: "600", fontSize: "0.875rem" }}>{t("login_email")}</label>
                                <input type="email" required
                                    placeholder={DEMO_MODE ? `e.g. ${cfg.hint.split(" / ")[0]}` : "Enter your email"}
                                    value={email} onChange={e => setEmail(e.target.value)} />
                            </div>
                            <div>
                                <label style={{ display: "block", marginBottom: "0.4rem", fontWeight: "600", fontSize: "0.875rem" }}>{t("login_password")}</label>
                                <div style={{ position: "relative" }}>
                                    <input type={showPassword ? "text" : "password"} required placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} style={{ paddingRight: "3rem" }} />
                                    <button type="button" onClick={() => setShowPassword(p => !p)} style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", fontSize: "1rem", color: "var(--text-muted)", padding: "0.25rem" }}>
                                        {showPassword ? "🙈" : "👁️"}
                                    </button>
                                </div>
                            </div>
                            {loginError && <div className="animate-fade-in" style={{ padding: "0.75rem 1rem", borderRadius: "0.625rem", background: "#ef444418", border: "1px solid #ef444440", color: "#ef4444", fontSize: "0.875rem" }}>⚠️ {loginError}</div>}
                            <button type="submit" disabled={loginLoading} className="btn btn-primary"
                                style={{ marginTop: "0.5rem", fontSize: "1rem", background: loginLoading ? "var(--text-faint)" : cfg.gradient, boxShadow: loginLoading ? "none" : `0 4px 20px ${cfg.color}44`, cursor: loginLoading ? "wait" : "pointer", gap: "0.5rem" }}
                            >
                                {loginLoading ? <><span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⏳</span> {t("login_signing_in")}</> : `${t("login_sign_in_as")} ${cfg.label}`}
                            </button>
                        </form>

                        {/* Sign-up CTA (citizen) */}
                        {selectedRole === "user" && (
                            <div style={{ marginTop: "1.5rem", paddingTop: "1.25rem", borderTop: "1px solid var(--border)", textAlign: "center" }}>
                                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>Don&apos;t have an account yet?</p>
                                <button type="button" onClick={() => switchMode("signup")}
                                    style={{ width: "100%", padding: "0.7rem 1.5rem", borderRadius: "var(--radius)", border: "2px solid #6366f140", background: "#6366f108", color: "#6366f1", fontWeight: "700", fontSize: "0.9rem", cursor: "pointer", transition: "var(--transition)", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
                                    onMouseEnter={e => { e.currentTarget.style.background = "#6366f118"; e.currentTarget.style.borderColor = "#6366f180"; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = "#6366f108"; e.currentTarget.style.borderColor = "#6366f140"; }}
                                >✨ Create a New Account</button>
                            </div>
                        )}

                        {/* Sign-up CTA (authority) */}
                        {selectedRole === "authority" && (
                            <div style={{ marginTop: "1.5rem", paddingTop: "1.25rem", borderTop: "1px solid var(--border)", textAlign: "center" }}>
                                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>Don&apos;t have an account yet?</p>
                                <button type="button" onClick={() => switchMode("auth-signup")}
                                    style={{ width: "100%", padding: "0.7rem 1.5rem", borderRadius: "var(--radius)", border: "2px solid #f9731640", background: "#f9731608", color: "#f97316", fontWeight: "700", fontSize: "0.9rem", cursor: "pointer", transition: "var(--transition)", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
                                    onMouseEnter={e => { e.currentTarget.style.background = "#f9731618"; e.currentTarget.style.borderColor = "#f9731680"; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = "#f9731608"; e.currentTarget.style.borderColor = "#f9731640"; }}
                                >🏗️ Create Authority Account</button>
                            </div>
                        )}

                        {/* Sign-up CTA (chief) */}
                        {selectedRole === "chief" && (
                            <div style={{ marginTop: "1.5rem", paddingTop: "1.25rem", borderTop: "1px solid var(--border)", textAlign: "center" }}>
                                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>Don&apos;t have an account yet?</p>
                                <button type="button" onClick={() => switchMode("chief-signup")}
                                    style={{ width: "100%", padding: "0.7rem 1.5rem", borderRadius: "var(--radius)", border: "2px solid #ec489940", background: "#ec489908", color: "#ec4899", fontWeight: "700", fontSize: "0.9rem", cursor: "pointer", transition: "var(--transition)", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
                                    onMouseEnter={e => { e.currentTarget.style.background = "#ec489918"; e.currentTarget.style.borderColor = "#ec489980"; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = "#ec489908"; e.currentTarget.style.borderColor = "#ec489940"; }}
                                >⭐ Create Chief Account</button>
                            </div>
                        )}
                    </div>
                )}

                {/* ══════════ SIGN-UP FORM ══════════ */}
                {mode === "signup" && (
                    <div className="glass animate-slide-up" style={{ padding: "2rem", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)" }}>

                        {/* Header */}
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
                            <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem", boxShadow: "0 4px 12px #6366f144" }}>✨</div>
                            <div>
                                <div style={{ fontWeight: "700", fontSize: "0.95rem" }}>Create Citizen Account</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Join the AI Grievance System — free & secure</div>
                            </div>
                        </div>

                        {/* Step progress indicator */}
                        <div style={{ display: "flex", gap: "0.35rem", marginBottom: "1.75rem" }}>
                            {["Personal", "ID Proof", "Location", "Security"].map((step, i) => (
                                <div key={step} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem" }}>
                                    <div style={{ height: "4px", width: "100%", borderRadius: "99px", background: "linear-gradient(90deg, #6366f1, #8b5cf6)" }} />
                                    <span style={{ fontSize: "0.58rem", color: "var(--text-muted)", fontWeight: "600" }}>{`${i + 1}. ${step}`}</span>
                                </div>
                            ))}
                        </div>

                        {suSuccess ? (
                            <div className="animate-fade-in" style={{ padding: "2.5rem", textAlign: "center" }}>
                                <div style={{ fontSize: "3.5rem", marginBottom: "0.75rem" }}>🎉</div>
                                <div style={{ fontWeight: "800", fontSize: "1.2rem", color: "#10b981", marginBottom: "0.4rem" }}>Account Created!</div>
                                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Redirecting you to login…</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSignup} noValidate style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

                                {/* ── Section 1: Personal ── */}
                                <div style={{ padding: "1rem", borderRadius: "0.875rem", background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.12)" }}>
                                    <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.875rem" }}>👤 Personal Information</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                                        <Field label="Full Name" icon="📛" error={suErrors.name}>
                                            <input style={inputStyle(!!suErrors.name)} type="text" placeholder="e.g. Rahul Kumar Sharma" value={su.name} onChange={e => setSuField("name", e.target.value)} />
                                        </Field>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                                            <Field label="Email Address" icon="📧" error={suErrors.email}>
                                                <input style={inputStyle(!!suErrors.email)} type="email" placeholder="you@example.com" value={su.email} onChange={e => setSuField("email", e.target.value)} />
                                            </Field>
                                            <Field label="Phone Number" icon="📱" error={suErrors.phone}>
                                                <input style={inputStyle(!!suErrors.phone)} type="tel" placeholder="10-digit mobile" maxLength={10} value={su.phone} onChange={e => setSuField("phone", e.target.value.replace(/\D/g, ""))} />
                                            </Field>
                                        </div>

                                        {/* ── Date of Birth ── */}
                                        <Field label="Date of Birth" icon="🎂" error={suErrors.dob}>
                                            <div style={{ position: "relative" }}>
                                                <input
                                                    style={{
                                                        ...inputStyle(!!suErrors.dob),
                                                        colorScheme: "dark",
                                                    }}
                                                    type="date"
                                                    max={(() => {
                                                        // max = today minus 18 years
                                                        const d = new Date();
                                                        d.setFullYear(d.getFullYear() - 18);
                                                        return d.toISOString().split("T")[0];
                                                    })()}
                                                    value={su.dob}
                                                    onChange={e => setSuField("dob", e.target.value)}
                                                />
                                                {su.dob && calculateAge(su.dob) >= 18 && (
                                                    <span style={{
                                                        position: "absolute", right: "0.75rem", top: "50%",
                                                        transform: "translateY(-50%)", fontSize: "0.75rem",
                                                        color: "#10b981", fontWeight: "700",
                                                    }}>✓ Age {calculateAge(su.dob)}</span>
                                                )}
                                            </div>
                                            <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", margin: "0.25rem 0 0" }}>
                                                You must be 18 years or older to register.
                                            </p>
                                        </Field>

                                        {/* ── Email OTP Verification ── */}
                                        <div style={{ padding: "0.875rem", borderRadius: "0.75rem", background: otpVerified ? "rgba(16,185,129,0.08)" : "rgba(99,102,241,0.06)", border: `1px solid ${otpVerified ? "#10b98130" : "rgba(99,102,241,0.2)"}`, transition: "all 0.3s ease" }}>
                                            <div style={{ fontSize: "0.7rem", fontWeight: "800", color: otpVerified ? "#10b981" : "#6366f1", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
                                                {otpVerified ? "✅ Email Verified" : "🔐 Verify Your Email"}
                                            </div>
                                            {otpVerified ? (
                                                <div style={{ fontSize: "0.82rem", color: "#10b981", fontWeight: "600" }}>
                                                    ✓ {su.email} has been verified successfully.
                                                </div>
                                            ) : (
                                                <>
                                                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                                                        <button type="button" onClick={sendOtp} disabled={otpLoading || otpCooldown > 0}
                                                            style={{ padding: "0.55rem 1rem", borderRadius: "0.625rem", fontSize: "0.78rem", fontWeight: "700", background: otpCooldown > 0 ? "var(--bg-card)" : "linear-gradient(135deg,#6366f1,#8b5cf6)", color: otpCooldown > 0 ? "var(--text-muted)" : "white", border: "none", cursor: otpCooldown > 0 ? "not-allowed" : "pointer", whiteSpace: "nowrap", transition: "var(--transition)" }}>
                                                            {otpLoading ? "Sending…" : otpCooldown > 0 ? `Resend in ${otpCooldown}s` : otpSent ? "Resend OTP" : "Send OTP"}
                                                        </button>
                                                        {otpSent && (
                                                            <input
                                                                style={{ ...inputStyle(false), flex: 1, fontFamily: "monospace", letterSpacing: "0.2em", textAlign: "center", fontSize: "1rem" }}
                                                                type="text" placeholder="6-digit OTP" maxLength={6}
                                                                value={otpValue} onChange={e => { setOtpValue(e.target.value.replace(/\D/g, "")); setOtpError(""); }}
                                                            />
                                                        )}
                                                        {otpSent && (
                                                            <button type="button" onClick={verifyOtp} disabled={otpLoading || otpValue.length !== 6}
                                                                style={{ padding: "0.55rem 1rem", borderRadius: "0.625rem", fontSize: "0.78rem", fontWeight: "700", background: otpValue.length === 6 ? "linear-gradient(135deg,#10b981,#06b6d4)" : "var(--bg-card)", color: otpValue.length === 6 ? "white" : "var(--text-muted)", border: "none", cursor: otpValue.length === 6 ? "pointer" : "not-allowed", whiteSpace: "nowrap", transition: "var(--transition)" }}>
                                                                {otpLoading ? "…" : "Verify"}
                                                            </button>
                                                        )}
                                                    </div>
                                                    {otpError && <p style={{ fontSize: "0.72rem", color: otpError.includes("Dev mode") ? "#f59e0b" : "#ef4444", margin: 0, fontWeight: "600" }}>{otpError}</p>}
                                                    {suErrors.otp && !otpSent && <p style={{ fontSize: "0.72rem", color: "#ef4444", margin: 0, fontWeight: "600" }}>⚠️ {suErrors.otp}</p>}
                                                    {!otpSent && <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", margin: 0 }}>A 6-digit OTP will be sent to your email to verify ownership.</p>}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* ── Section 2: Aadhaar Verification ── */}
                                <div style={{ padding: "1rem", borderRadius: "0.875rem", background: "rgba(236,72,153,0.05)", border: "1px solid rgba(236,72,153,0.12)" }}>
                                    <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "#ec4899", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>🪪 Aadhaar Verification</div>
                                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: "0 0 0.875rem", lineHeight: 1.5 }}>
                                        We use Aadhaar's built-in Verhoeff checksum algorithm — the same used by UIDAI — to verify your number is genuine before registration.
                                    </p>

                                    <Field label="Aadhaar Number" icon="🪪" error={suErrors.idNumber}>
                                        <input
                                            style={{ ...inputStyle(!!suErrors.idNumber), fontFamily: "monospace", letterSpacing: "0.15em", fontSize: "1rem" }}
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="Enter 12-digit Aadhaar number"
                                            value={su.idNumber}
                                            maxLength={12}
                                            onChange={e => setSuField("idNumber", e.target.value.replace(/\D/g, ""))}
                                        />
                                        {su.idNumber.length === 12 && !validateAadhaar(su.idNumber) && (
                                            <p style={{ fontSize: "0.72rem", color: "#10b981", margin: "0.3rem 0 0", fontWeight: "700" }}>✅ Valid Aadhaar (checksum passed)</p>
                                        )}
                                        <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", margin: "0.25rem 0 0" }}>
                                            Your Aadhaar number is hashed (SHA-256) before storage — it is never saved in plain text.
                                        </p>
                                    </Field>
                                </div>

                                {/* ── Section 3: Location ── */}
                                <div style={{ padding: "1rem", borderRadius: "0.875rem", background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.12)" }}>
                                    <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "#10b981", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.875rem" }}>📍 Location Details</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                                        <Field label="State" icon="🗺️" error={suErrors.state}>
                                            <select
                                                value={su.state}
                                                onChange={e => { setSuField("state", e.target.value); setSuField("district", ""); }}
                                                style={{ ...inputStyle(!!suErrors.state), appearance: "none", cursor: "pointer" }}
                                            >
                                                <option value="">— Select State / UT —</option>
                                                {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </Field>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                                            <Field label="District" icon="🏘️" error={suErrors.district}>
                                                <select
                                                    value={su.district}
                                                    onChange={e => setSuField("district", e.target.value)}
                                                    style={{ ...inputStyle(!!suErrors.district), appearance: "none", cursor: su.state ? "pointer" : "not-allowed", opacity: su.state ? 1 : 0.5 }}
                                                    disabled={!su.state}
                                                >
                                                    <option value="">{su.state ? "— Select District —" : "— Select State first —"}</option>
                                                    {(DISTRICTS_BY_STATE[su.state] || []).map(d => <option key={d} value={d}>{d}</option>)}
                                                </select>
                                            </Field>
                                            <Field label="Pincode" icon="📮" error={suErrors.pincode}>
                                                <input style={inputStyle(!!suErrors.pincode)} type="text" placeholder="6-digit pincode" maxLength={6} value={su.pincode} onChange={e => setSuField("pincode", e.target.value.replace(/\D/g, ""))} />
                                            </Field>
                                        </div>
                                    </div>
                                </div>

                                {/* ── Section 4: Password ── */}
                                <div style={{ padding: "1rem", borderRadius: "0.875rem", background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.12)" }}>
                                    <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.875rem" }}>🔒 Account Security</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                                        <Field label="Password" icon="🔑" error={suErrors.password}>
                                            <div style={{ position: "relative" }}>
                                                <input style={{ ...inputStyle(!!suErrors.password), paddingRight: "3rem" }} type={showSuPw ? "text" : "password"} placeholder="Min. 8 chars • Uppercase • Special char" value={su.password} onChange={e => setSuField("password", e.target.value)} />
                                                <button type="button" onClick={() => setShowSuPw(p => !p)} style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", fontSize: "0.95rem", color: "var(--text-muted)", padding: "0.2rem" }}>
                                                    {showSuPw ? "🙈" : "👁️"}
                                                </button>
                                            </div>
                                            {su.password.length > 0 && (
                                                <div style={{ marginTop: "0.6rem" }}>
                                                    {/* Strength bar */}
                                                    <div style={{ height: "4px", borderRadius: "99px", background: "var(--border)", overflow: "hidden", marginBottom: "0.5rem" }}>
                                                        <div style={{ height: "100%", borderRadius: "99px", transition: "width 0.4s ease, background 0.4s ease", width: pwScore === 1 ? "33%" : pwScore === 2 ? "66%" : "100%", background: pwColor }} />
                                                    </div>
                                                    {/* Live rule checklist */}
                                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                                        {[
                                                            { ok: pwHasLen, label: "At least 8 characters" },
                                                            { ok: pwHasUpper, label: "One uppercase letter (A–Z)" },
                                                            { ok: pwHasSpecial, label: "One special character (!@#$%…)" },
                                                        ].map(rule => (
                                                            <div key={rule.label} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                                                <span style={{ fontSize: "0.75rem", lineHeight: 1 }}>{rule.ok ? "✅" : "❌"}</span>
                                                                <span style={{ fontSize: "0.7rem", fontWeight: "600", color: rule.ok ? "#10b981" : "#94a3b8", transition: "color 0.2s" }}>{rule.label}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </Field>
                                        <Field label="Confirm Password" icon="🔒" error={suErrors.confirm}>
                                            <input style={{ ...inputStyle(!!suErrors.confirm), borderColor: su.confirm && su.confirm !== su.password ? "#ef4444" : undefined }} type="password" placeholder="Re-enter your password" value={su.confirm} onChange={e => setSuField("confirm", e.target.value)} />
                                        </Field>
                                    </div>
                                </div>

                                {/* Submit */}
                                <button type="submit" disabled={suLoading} className="btn btn-primary"
                                    style={{ fontSize: "1rem", cursor: suLoading ? "wait" : "pointer", background: suLoading ? "var(--text-faint)" : undefined, gap: "0.5rem", marginTop: "0.25rem" }}
                                >
                                    {suLoading ? <><span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⏳</span> Creating Account…</> : "✨ Create My Account"}
                                </button>

                                {/* Back to login */}
                                <div style={{ textAlign: "center", paddingTop: "0.5rem", borderTop: "1px solid var(--border)" }}>
                                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.4rem" }}>Already have an account?</p>
                                    <button type="button" onClick={() => switchMode("login")}
                                        style={{ background: "transparent", border: "none", color: "#6366f1", fontWeight: "700", fontSize: "0.875rem", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "3px" }}
                                    >← Back to Login</button>
                                </div>
                            </form>
                        )}
                    </div>
                )}

                {/* ══════════ AUTHORITY SIGN-UP FORM ══════════ */}
                {mode === "auth-signup" && (
                    <div className="glass animate-slide-up" style={{ padding: "2rem", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)" }}>

                        {/* Header */}
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
                            <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "linear-gradient(135deg, #f97316, #fb923c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem", boxShadow: "0 4px 12px #f9731644" }}>🏛️</div>
                            <div>
                                <div style={{ fontWeight: "700", fontSize: "0.95rem" }}>Create Authority Account</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Government Officer Registration — secure &amp; verified</div>
                            </div>
                        </div>

                        {/* Step progress */}
                        <div style={{ display: "flex", gap: "0.35rem", marginBottom: "1.75rem" }}>
                            {["Personal", "Authority Details", "Security"].map((step, i) => (
                                <div key={step} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem" }}>
                                    <div style={{ height: "4px", width: "100%", borderRadius: "99px", background: "linear-gradient(90deg, #f97316, #fb923c)" }} />
                                    <span style={{ fontSize: "0.58rem", color: "var(--text-muted)", fontWeight: "600" }}>{`${i + 1}. ${step}`}</span>
                                </div>
                            ))}
                        </div>

                        {auSuccess ? (
                            <div className="animate-fade-in" style={{ padding: "2.5rem", textAlign: "center" }}>
                                <div style={{ fontSize: "3.5rem", marginBottom: "0.75rem" }}>🎉</div>
                                <div style={{ fontWeight: "800", fontSize: "1.2rem", color: "#10b981", marginBottom: "0.4rem" }}>Authority Account Created!</div>
                                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Redirecting you to login…</p>
                            </div>
                        ) : (
                            <form onSubmit={handleAuthSignup} noValidate style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

                                {/* ── Section 1: Personal Info ── */}
                                <div style={{ padding: "1rem", borderRadius: "0.875rem", background: "rgba(249,115,22,0.05)", border: "1px solid rgba(249,115,22,0.12)" }}>
                                    <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "#f97316", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.875rem" }}>👤 Personal Information</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                                        <Field label="Full Name" icon="📛" error={auErrors.name}>
                                            <input style={inputStyle(!!auErrors.name)} type="text" placeholder="e.g. Officer Rajesh Kumar" value={au.name} onChange={e => setAuField("name", e.target.value)} />
                                        </Field>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                                            <Field label="Email Address" icon="📧" error={auErrors.email}>
                                                <input style={inputStyle(!!auErrors.email)} type="email" placeholder="officer@gov.in" value={au.email} onChange={e => setAuField("email", e.target.value)} />
                                            </Field>
                                            <Field label="Phone Number" icon="📱" error={auErrors.phone}>
                                                <input style={inputStyle(!!auErrors.phone)} type="tel" placeholder="10-digit mobile" maxLength={10} value={au.phone} onChange={e => setAuField("phone", e.target.value.replace(/\D/g, ""))} />
                                            </Field>
                                        </div>
                                    </div>
                                </div>

                                {/* ── Section 2: Authority Details ── */}
                                <div style={{ padding: "1rem", borderRadius: "0.875rem", background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.12)" }}>
                                    <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.875rem" }}>🏛️ Authority Details</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>

                                        {/* Authority Role */}
                                        <Field label="Authority Role" icon="🎖️" error={auErrors.authorityRole}>
                                            <select
                                                value={au.authorityRole}
                                                onChange={e => setAuField("authorityRole", e.target.value)}
                                                style={{ ...inputStyle(!!auErrors.authorityRole), appearance: "none", cursor: "pointer" }}
                                            >
                                                <option value="">— Select Your Authority Role —</option>
                                                <option value="Municipal Corporation Officer">🏙️ Municipal Corporation Officer</option>
                                                <option value="Health & Sanitation Inspector">🏥 Health &amp; Sanitation Inspector</option>
                                                <option value="Environment Protection Officer">🌿 Environment Protection Officer</option>
                                                <option value="Traffic Management Officer">🚦 Traffic Management Officer</option>
                                                <option value="Infrastructure & PWD Engineer">🏗️ Infrastructure &amp; PWD Engineer</option>
                                                <option value="Revenue Department Officer">💼 Revenue Department Officer</option>
                                                <option value="Police Administrative Officer">👮 Police Administrative Officer</option>
                                                <option value="Education Department Officer">📚 Education Department Officer</option>
                                                <option value="Water Supply & Sewerage Officer">💧 Water Supply &amp; Sewerage Officer</option>
                                                <option value="Electricity Board Officer">⚡ Electricity Board Officer</option>
                                            </select>
                                        </Field>

                                        {/* Service Card ID + Working Place */}
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                                            <Field label="Service Card ID" icon="🪪" error={auErrors.serviceId}>
                                                <input
                                                    style={{ ...inputStyle(!!auErrors.serviceId), fontFamily: "monospace", letterSpacing: "0.06em", textTransform: "uppercase" }}
                                                    type="text"
                                                    placeholder="e.g. GOV/MH/2024/00123"
                                                    value={au.serviceId}
                                                    maxLength={20}
                                                    onChange={e => setAuField("serviceId", e.target.value)}
                                                />
                                            </Field>
                                            <Field label="Working Place / Office" icon="🏢" error={auErrors.workingPlace}>
                                                <input
                                                    style={inputStyle(!!auErrors.workingPlace)}
                                                    type="text"
                                                    placeholder="e.g. Municipal Corp, Ward 5"
                                                    value={au.workingPlace}
                                                    onChange={e => setAuField("workingPlace", e.target.value)}
                                                />
                                            </Field>
                                        </div>

                                        {/* State + District */}
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                                            <Field label="State" icon="🗺️" error={auErrors.state}>
                                                <select
                                                    value={au.state}
                                                    onChange={e => { setAuField("state", e.target.value); setAuField("district", ""); }}
                                                    style={{ ...inputStyle(!!auErrors.state), appearance: "none", cursor: "pointer" }}
                                                >
                                                    <option value="">— Select State —</option>
                                                    {Object.keys(DISTRICTS_BY_STATE).sort().map(s => (
                                                        <option key={s} value={s}>{s}</option>
                                                    ))}
                                                </select>
                                            </Field>
                                            <Field label="District" icon="📍" error={auErrors.district}>
                                                <select
                                                    value={au.district}
                                                    onChange={e => setAuField("district", e.target.value)}
                                                    disabled={!au.state}
                                                    style={{ ...inputStyle(!!auErrors.district), appearance: "none", cursor: au.state ? "pointer" : "not-allowed", opacity: au.state ? 1 : 0.5 }}
                                                >
                                                    <option value="">{au.state ? "— Select District —" : "Select state first"}</option>
                                                    {(DISTRICTS_BY_STATE[au.state] || []).map((d: string) => (
                                                        <option key={d} value={d}>{d}</option>
                                                    ))}
                                                </select>
                                            </Field>
                                        </div>
                                    </div>
                                </div>

                                {/* ── Section 3: Security ── */}
                                <div style={{ padding: "1rem", borderRadius: "0.875rem", background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.12)" }}>
                                    <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.875rem" }}>🔒 Account Security</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                                        <Field label="Password" icon="🔑" error={auErrors.password}>
                                            <div style={{ position: "relative" }}>
                                                <input
                                                    style={{ ...inputStyle(!!auErrors.password), paddingRight: "3rem" }}
                                                    type={showAuPw ? "text" : "password"}
                                                    placeholder="Min. 8 chars • Uppercase • Special char"
                                                    value={au.password}
                                                    onChange={e => setAuField("password", e.target.value)}
                                                />
                                                <button type="button" onClick={() => setShowAuPw(p => !p)} style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", fontSize: "0.95rem", color: "var(--text-muted)", padding: "0.2rem" }}>
                                                    {showAuPw ? "🙈" : "👁️"}
                                                </button>
                                            </div>
                                            {au.password.length > 0 && (
                                                <div style={{ marginTop: "0.6rem" }}>
                                                    <div style={{ height: "4px", borderRadius: "99px", background: "var(--border)", overflow: "hidden", marginBottom: "0.5rem" }}>
                                                        <div style={{ height: "100%", borderRadius: "99px", transition: "width 0.4s ease, background 0.4s ease", width: auPwScore === 1 ? "33%" : auPwScore === 2 ? "66%" : "100%", background: auPwColor }} />
                                                    </div>
                                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                                        {[
                                                            { ok: auPwHasLen, label: "At least 8 characters" },
                                                            { ok: auPwHasUpper, label: "One uppercase letter (A–Z)" },
                                                            { ok: auPwHasSpecial, label: "One special character (!@#$%…)" },
                                                        ].map(rule => (
                                                            <div key={rule.label} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                                                <span style={{ fontSize: "0.75rem", lineHeight: 1 }}>{rule.ok ? "✅" : "❌"}</span>
                                                                <span style={{ fontSize: "0.7rem", fontWeight: "600", color: rule.ok ? "#10b981" : "#94a3b8", transition: "color 0.2s" }}>{rule.label}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </Field>
                                        <Field label="Confirm Password" icon="🔒" error={auErrors.confirm}>
                                            <input
                                                style={{ ...inputStyle(!!auErrors.confirm), borderColor: au.confirm && au.confirm !== au.password ? "#ef4444" : undefined }}
                                                type="password"
                                                placeholder="Re-enter your password"
                                                value={au.confirm}
                                                onChange={e => setAuField("confirm", e.target.value)}
                                            />
                                        </Field>
                                    </div>
                                </div>

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={auLoading}
                                    className="btn"
                                    style={{ fontSize: "1rem", cursor: auLoading ? "wait" : "pointer", background: auLoading ? "var(--text-faint)" : "linear-gradient(135deg, #f97316, #fb923c)", color: "white", boxShadow: auLoading ? "none" : "0 4px 20px rgba(249,115,22,0.4)", gap: "0.5rem", marginTop: "0.25rem" }}
                                >
                                    {auLoading ? <><span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⏳</span> Creating Account…</> : "🏛️ Create Authority Account"}
                                </button>

                                {/* Back to login */}
                                <div style={{ textAlign: "center", paddingTop: "0.5rem", borderTop: "1px solid var(--border)" }}>
                                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.4rem" }}>Already have an account?</p>
                                    <button type="button" onClick={() => switchMode("login")}
                                        style={{ background: "transparent", border: "none", color: "#f97316", fontWeight: "700", fontSize: "0.875rem", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "3px" }}
                                    >← Back to Login</button>
                                </div>
                            </form>
                        )}
                    </div>
                )}

                {/* ══════════ CHIEF SIGN-UP FORM ══════════ */}
                {mode === "chief-signup" && (
                    <div className="glass animate-slide-up" style={{ padding: "2rem", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)" }}>

                        {/* Header */}
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
                            <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "linear-gradient(135deg, #ec4899, #f43f5e)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.35rem", boxShadow: "0 4px 16px #ec489944" }}>⭐</div>
                            <div>
                                <div style={{ fontWeight: "800", fontSize: "1rem", letterSpacing: "-0.01em" }}>Create Chief Account</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Chief Commissioner Registration — highest authority</div>
                            </div>
                        </div>

                        {/* Step bar */}
                        <div style={{ display: "flex", gap: "0.35rem", marginBottom: "1.75rem" }}>
                            {["Personal", "Officer ID", "Security"].map((step, i) => (
                                <div key={step} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem" }}>
                                    <div style={{ height: "4px", width: "100%", borderRadius: "99px", background: "linear-gradient(90deg, #ec4899, #f43f5e)" }} />
                                    <span style={{ fontSize: "0.58rem", color: "var(--text-muted)", fontWeight: "600" }}>{`${i + 1}. ${step}`}</span>
                                </div>
                            ))}
                        </div>

                        {chSuccess ? (
                            <div className="animate-fade-in" style={{ padding: "2.5rem", textAlign: "center" }}>
                                <div style={{ fontSize: "3.5rem", marginBottom: "0.75rem" }}>🎉</div>
                                <div style={{ fontWeight: "800", fontSize: "1.2rem", color: "#10b981", marginBottom: "0.4rem" }}>Chief Account Created!</div>
                                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Redirecting you to login…</p>
                            </div>
                        ) : (
                            <form onSubmit={handleChiefSignup} noValidate style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

                                {/* ── Section 1: Personal Info ── */}
                                <div style={{ padding: "1rem", borderRadius: "0.875rem", background: "rgba(236,72,153,0.05)", border: "1px solid rgba(236,72,153,0.12)" }}>
                                    <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "#ec4899", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.875rem" }}>👤 Personal Information</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                                        <Field label="Full Name" icon="📛" error={chErrors.name}>
                                            <input style={inputStyle(!!chErrors.name)} type="text" placeholder="e.g. Chief Commissioner Arvind" value={ch.name} onChange={e => setChField("name", e.target.value)} />
                                        </Field>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                                            <Field label="Email Address" icon="📧" error={chErrors.email}>
                                                <input style={inputStyle(!!chErrors.email)} type="email" placeholder="chief@gov.in" value={ch.email} onChange={e => setChField("email", e.target.value)} />
                                            </Field>
                                            <Field label="Phone Number" icon="📱" error={chErrors.phone}>
                                                <input style={inputStyle(!!chErrors.phone)} type="tel" placeholder="10-digit mobile" maxLength={10} value={ch.phone} onChange={e => setChField("phone", e.target.value.replace(/\D/g, ""))} />
                                            </Field>
                                        </div>
                                    </div>
                                </div>

                                {/* ── Section 2: Officer ID ── */}
                                <div style={{ padding: "1rem", borderRadius: "0.875rem", background: "rgba(244,63,94,0.05)", border: "1px solid rgba(244,63,94,0.12)" }}>
                                    <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "#f43f5e", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.875rem" }}>🪪 Officer Identification</div>
                                    <Field label="Officer ID" icon="⭐" error={chErrors.officerId}>
                                        <input
                                            style={{ ...inputStyle(!!chErrors.officerId), fontFamily: "monospace", letterSpacing: "0.08em", textTransform: "uppercase", fontSize: "1rem", fontWeight: "700" }}
                                            type="text"
                                            placeholder="e.g. CHIEF-2024-001"
                                            maxLength={20}
                                            value={ch.officerId}
                                            onChange={e => setChField("officerId", e.target.value)}
                                        />
                                        <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.4rem" }}>
                                            📌 Must be <strong>6–20 characters</strong> containing both <strong>letters &amp; digits</strong>. Example: <code style={{ background: "rgba(236,72,153,0.12)", padding: "0.1rem 0.35rem", borderRadius: "4px", fontFamily: "monospace" }}>CHIEF-2024-001</code>
                                        </p>
                                    </Field>
                                </div>

                                {/* ── Section 3: Security ── */}
                                <div style={{ padding: "1rem", borderRadius: "0.875rem", background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.12)" }}>
                                    <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.875rem" }}>🔒 Account Security</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                                        <Field label="Password" icon="🔑" error={chErrors.password}>
                                            <div style={{ position: "relative" }}>
                                                <input
                                                    style={{ ...inputStyle(!!chErrors.password), paddingRight: "3rem" }}
                                                    type={showChPw ? "text" : "password"}
                                                    placeholder="Min. 8 chars • Uppercase • Special char"
                                                    value={ch.password}
                                                    onChange={e => setChField("password", e.target.value)}
                                                />
                                                <button type="button" onClick={() => setShowChPw(p => !p)} style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", fontSize: "0.95rem", color: "var(--text-muted)", padding: "0.2rem" }}>
                                                    {showChPw ? "🙈" : "👁️"}
                                                </button>
                                            </div>
                                            {ch.password.length > 0 && (
                                                <div style={{ marginTop: "0.6rem" }}>
                                                    <div style={{ height: "4px", borderRadius: "99px", background: "var(--border)", overflow: "hidden", marginBottom: "0.5rem" }}>
                                                        <div style={{ height: "100%", borderRadius: "99px", transition: "width 0.4s ease, background 0.4s ease", width: chPwScore === 1 ? "33%" : chPwScore === 2 ? "66%" : "100%", background: chPwColor }} />
                                                    </div>
                                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                                        {[
                                                            { ok: chPwHasLen, label: "At least 8 characters" },
                                                            { ok: chPwHasUpper, label: "One uppercase letter (A–Z)" },
                                                            { ok: chPwHasSpecial, label: "One special character (!@#$%…)" },
                                                        ].map(rule => (
                                                            <div key={rule.label} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                                                <span style={{ fontSize: "0.75rem", lineHeight: 1 }}>{rule.ok ? "✅" : "❌"}</span>
                                                                <span style={{ fontSize: "0.7rem", fontWeight: "600", color: rule.ok ? "#10b981" : "#94a3b8", transition: "color 0.2s" }}>{rule.label}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </Field>
                                        <Field label="Confirm Password" icon="🔒" error={chErrors.confirm}>
                                            <input
                                                style={{ ...inputStyle(!!chErrors.confirm), borderColor: ch.confirm && ch.confirm !== ch.password ? "#ef4444" : undefined }}
                                                type="password"
                                                placeholder="Re-enter your password"
                                                value={ch.confirm}
                                                onChange={e => setChField("confirm", e.target.value)}
                                            />
                                        </Field>
                                    </div>
                                </div>

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={chLoading}
                                    className="btn"
                                    style={{ fontSize: "1rem", cursor: chLoading ? "wait" : "pointer", background: chLoading ? "var(--text-faint)" : "linear-gradient(135deg, #ec4899, #f43f5e)", color: "white", boxShadow: chLoading ? "none" : "0 4px 20px rgba(236,72,153,0.4)", gap: "0.5rem", marginTop: "0.25rem" }}
                                >
                                    {chLoading ? <><span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⏳</span> Creating Account…</> : "⭐ Create Chief Account"}
                                </button>

                                {/* Back to login */}
                                <div style={{ textAlign: "center", paddingTop: "0.5rem", borderTop: "1px solid var(--border)" }}>
                                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.4rem" }}>Already have an account?</p>
                                    <button type="button" onClick={() => switchMode("login")}
                                        style={{ background: "transparent", border: "none", color: "#ec4899", fontWeight: "700", fontSize: "0.875rem", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "3px" }}
                                    >← Back to Login</button>
                                </div>
                            </form>
                        )}
                    </div>
                )}

                <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.72rem", color: "var(--text-faint)" }}>
                    🔒 Secure System — Live Database Active
                </p>
            </div>

            <style>{`
                @keyframes glowPulse { 0%,100%{box-shadow:0 0 0 0 currentColor;opacity:1} 50%{box-shadow:0 0 0 6px transparent;opacity:0.6} }
                @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
                select option { background: var(--bg-card); color: var(--text-main); }
            `}</style>
        </main>
    );
}
