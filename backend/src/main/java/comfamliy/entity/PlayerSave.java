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
     *
     *  ★追加修正: プリミティブ型 int だと、この修正より前から存在する既存プレイヤーの行では
     *          ddl-auto=update で追加されたカラムが NULL のままになる。JDBCの ResultSet.getInt()
     *          は NULL を黙って 0 に丸めてしまうため、save.js 側の「値が無ければ3個プレゼント」
     *          という救済ロジック（data.gachaTickets ?? 3）が、既存プレイヤーに対しては
     *          「本物の0」と区別できず発動しない（常に0個になる）バグになっていた。
     *          Integer（ボクシング型）にすることで DB の NULL を JSON の null としてそのまま
     *          フロントへ伝え、救済ロジックを正しく機能させる。
     */
    private Integer gachaTickets;

    private LocalDateTime updatedAt;
}