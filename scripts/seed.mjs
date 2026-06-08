import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://lxjevqkbkxafqknevbwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_TbfQF0Q4zPSBZn_XsyZHhA_E_oNyx-M";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
}

const COMPLAINTS = [
    {
        id: "GRV-10001",
        subject: "Sewage Water Overflowing on Main Road",
        description: "Sewage water has been overflowing onto the main road near Gandhi Nagar for the past 5 days. The smell is unbearable and people are falling sick. Children cannot walk to school safely.",
        location: "Gandhi Nagar, Main Road",
        category: "Environment",
        priority: "Critical",
        status: "Pending",
        user_email: "ramesh.kumar@gmail.com",
        attachment_count: 2,
        ai_reasoning: "Detected water/pollution pattern. Escalated to Critical due to public health risk.",
        created_at: daysAgo(6),
        updated_at: daysAgo(6),
    },
    {
        id: "GRV-10002",
        subject: "Large Pothole on NH-48 Near Flyover",
        description: "A 3-foot deep pothole has formed on NH-48 near the City Flyover junction. Two two-wheelers have already met with accidents this week. The road is extremely dangerous at night with no street lighting nearby.",
        location: "NH-48, City Flyover Junction",
        category: "Infrastructure",
        priority: "High",
        status: "In Progress",
        user_email: "priya.sharma@yahoo.com",
        attachment_count: 4,
        ai_reasoning: "Detected road/infrastructure pattern. Assigned to NHAI road repair team.",
        created_at: daysAgo(5),
        updated_at: daysAgo(2),
    },
    {
        id: "GRV-10003",
        subject: "District Hospital OPD Severely Understaffed",
        description: "The District General Hospital OPD has only 2 doctors available for over 300 patients daily. Wait times exceed 5 hours. Elderly patients are collapsing in queues. Emergency staff deployment is urgently needed.",
        location: "District General Hospital, Sector 4",
        category: "Public Health",
        priority: "High",
        status: "Pending",
        user_email: "alice.fernandez@gmail.com",
        attachment_count: 1,
        ai_reasoning: "Detected hospital/health pattern. Forwarded to Health Director office.",
        created_at: daysAgo(4),
        updated_at: daysAgo(4),
    },
    {
        id: "GRV-10004",
        subject: "Illegal Commercial Parking Blocking Emergency Access",
        description: "Commercial vehicles are illegally parked on the footpath and road in front of City Mall in Zone B every day. Emergency vehicles cannot pass through. Police complaints have been ignored.",
        location: "City Mall, Zone B",
        category: "Safety",
        priority: "Medium",
        status: "Resolved",
        user_email: "rohit.verma@hotmail.com",
        attachment_count: 0,
        ai_reasoning: "Detected safety pattern. Traffic unit deployed. 6 vehicles towed. Issue resolved.",
        created_at: daysAgo(8),
        updated_at: daysAgo(3),
    },
    {
        id: "GRV-10005",
        subject: "Factory Releasing Black Smoke 24 Hours",
        description: "A chemical factory in the Industrial Area has been releasing thick black smoke continuously for 10 days. Multiple residents are reporting respiratory problems. Children and elderly are most affected. Immediate intervention required.",
        location: "Industrial Area, Phase 2",
        category: "Environment",
        priority: "Critical",
        status: "In Progress",
        user_email: "meena.patel@gmail.com",
        attachment_count: 3,
        ai_reasoning: "Detected pollution/environment pattern. Escalated to Pollution Control Board.",
        created_at: daysAgo(3),
        updated_at: daysAgo(1),
    },
    {
        id: "GRV-10006",
        subject: "Street Lights Non-functional for 2 Weeks",
        description: "All 12 street lights on MG Road between Sectors 5 and 7 have been non-functional for 2 weeks. The road is completely dark at night and residents fear for their safety during evening walks.",
        location: "MG Road, Sector 5 to 7",
        category: "Infrastructure",
        priority: "Medium",
        status: "Pending",
        user_email: "john.mathew@gmail.com",
        attachment_count: 2,
        ai_reasoning: "Detected infrastructure pattern. Assigned to Municipal Electrical Department.",
        created_at: daysAgo(2),
        updated_at: daysAgo(2),
    },
    {
        id: "GRV-10007",
        subject: "Broken Footpath Near Government School Injuring Students",
        description: "The footpath in front of Sunrise Government School on MG Road has large cracks and exposed iron rods. Three students have already been injured. The school principal has raised the issue twice with no response.",
        location: "MG Road, Near Sunrise Government School",
        category: "Safety",
        priority: "High",
        status: "Resolved",
        user_email: "sunita.devi@gmail.com",
        attachment_count: 5,
        ai_reasoning: "Detected safety/infrastructure pattern. Municipal repair team deployed. Work completed successfully.",
        created_at: daysAgo(10),
        updated_at: daysAgo(1),
    },
    {
        id: "GRV-10008",
        subject: "Garbage Not Collected for 10 Days in Residential Colony",
        description: "Garbage has not been collected from Green Valley Colony for 10 consecutive days. The garbage dump near Block C is overflowing. Stray animals are spreading garbage across the neighbourhood creating serious hygiene issues.",
        location: "Green Valley Colony, Block C",
        category: "Environment",
        priority: "Medium",
        status: "Pending",
        user_email: "rajesh.nair@gmail.com",
        attachment_count: 1,
        ai_reasoning: "Detected environment/waste pattern. Sanitation department notified.",
        created_at: daysAgo(1),
        updated_at: daysAgo(1),
    },
    {
        id: "GRV-10009",
        subject: "Tap Water Contaminated — Brownish Colour and Foul Smell",
        description: "Tap water in Block D of Shanti Nagar has turned brownish-yellow with a strong foul odour since 3 days. Over 50 families are affected. Multiple residents have developed stomach infections. Lab testing and immediate halt requested.",
        location: "Shanti Nagar, Block D",
        category: "Public Health",
        priority: "Critical",
        status: "In Progress",
        user_email: "kavitha.iyer@gmail.com",
        attachment_count: 2,
        ai_reasoning: "Detected water contamination pattern. Public Health lab team dispatched for testing.",
        created_at: daysAgo(3),
        updated_at: daysAgo(0),
    },
    {
        id: "GRV-10010",
        subject: "No Bus Service to Village for Past 1 Month",
        description: "The government bus service connecting Rampur Village to the city has been suspended for over a month with no official notice. Over 2000 villagers including students and daily wage workers are heavily affected.",
        location: "Rampur Village, District Highway",
        category: "Administrative",
        priority: "Low",
        status: "Rejected",
        user_email: "vikram.singh@gmail.com",
        attachment_count: 0,
        ai_reasoning: "Detected administrative pattern. Complaint forwarded to District Transport Officer. Route suspension confirmed as scheduled maintenance.",
        created_at: daysAgo(7),
        updated_at: daysAgo(2),
    },
];

async function seed() {
    console.log("🌱 Starting seed — inserting", COMPLAINTS.length, "complaints into Supabase...\n");

    let success = 0;
    let skipped = 0;

    for (const complaint of COMPLAINTS) {
        const { error } = await supabase
            .from("complaints")
            .upsert(complaint, { onConflict: "id" }); // upsert so re-running won't duplicate

        if (error) {
            console.error(`  ❌ Failed ${complaint.id}:`, error.message);
            skipped++;
        } else {
            console.log(`  ✅ ${complaint.id} — ${complaint.subject}`);
            success++;
        }
    }

    console.log(`\n🎉 Done! ${success} inserted/updated, ${skipped} failed.`);
    console.log("👉 Refresh your Admin/Chief Dashboard to see live data!\n");
}

seed();
