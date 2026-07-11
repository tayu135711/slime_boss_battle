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

    /** アクセサリー（JSON文字列） ★ 追加 */
    @Column(columnDefinition = "TEXT")
    private String accessories;

    /** ステージ別ベストタイム（JSON文字列） ★ 追加 */
    @Column(columnDefinition = "TEXT")
    private String bestTimes;

    /** 累計クリア数 ★ 追加 */
    private int totalClears;

    /** ガチャ石（チケット）所持数
     *  ★修正: フロントエンド(save.js)は毎回 gachaTickets をリクエストボディに含めて送信しているが、
     *          このエンティティにフィールドが存在しなかったため、DBには一切保存されずに
     *          サーバー再起動やブラウザのlocalStorageクリア・別端末でのロード時に
     *          ガチャ石の所持数が毎回3個にリセットされてしまうバグがあった。
     */
    private int gachaTickets;

    private LocalDateTime updatedAt;
}
