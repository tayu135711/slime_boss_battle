package comfamliy.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.Data;

@Entity
@Table(name = "player_saves")
@Data
public class PlayerSave {

    @Id
    @Column(name = "player_id")
    private String playerId;

    private int stageIndex;
    private int unlockedStages;
    private String equippedCostumeId;

    @Column(columnDefinition = "TEXT")
    private String ownedCostumes;

    @Column(columnDefinition = "TEXT")
    private String inventory;

    @Column(columnDefinition = "TEXT")
    private String bento;

    private int dailyFishCount;
    private String lastFishDate;
    private int dailyFlowerCount;
    private String lastFlowerDate;

    /** クエスト進捗（JSON文字列） */
    @Column(columnDefinition = "TEXT")
    private String quests;

    /** お弁当最大数 */
    private int maxBento;

    /** 解放済みレシピ（JSON文字列） */
    @Column(columnDefinition = "TEXT")
    private String unlockedRecipes;

    private LocalDateTime updatedAt;
}