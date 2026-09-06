package com.aigrievance.system.repository;

import com.aigrievance.system.model.Complaint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ComplaintRepository extends JpaRepository<Complaint, String> {
    List<Complaint> findByUserEmailOrderByCreatedAtDesc(String userEmail);
    List<Complaint> findAllByOrderByCreatedAtDesc();
}
