package comfamliy.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import comfamliy.entity.PlayerSave;

@Repository
public interface PlayerSaveRepository extends JpaRepository<PlayerSave, String> {
}