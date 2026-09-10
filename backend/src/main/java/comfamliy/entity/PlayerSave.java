package comfamliy.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Size;
import com.fasterxml.jackson.annotation.JsonIgnore;

import lombok.Data;

@Entity
@Table(name = "player_saves")
@Data
public class PlayerSave {

    @Id
    @Column(name = "player_id")
    @NotBlank
    @Size(max = 64)
    private String playerId;

    @Min(0)
    private int stageIndex;
    @Min(0)
    private int unlockedStages;
    @Size(max = 64)
    private String equippedCostumeId;

    @Column(columnDefinition = "TEXT")
    @Size(max = 200000)
    private String ownedCostumes;

    @Column(columnDefinition = "TEXT")
    @Size(max = 200000)
    private String inventory;

    @Column(columnDefinition = "TEXT")
    @Size(max = 200000)
    private String bento;

    @Min(0)
    private int dailyFishCount;
    @Size(max = 32)
    private String lastFishDate;
    @Min(0)
    private int dailyFlowerCount;
    @Size(max = 32)
    private String lastFlowerDate;

    /** クエスト進捗（JSON文字列） */
    @Column(columnDefinition = "TEXT")
    @Size(max = 200000)
    private String quests;

    /** お弁当最大数 */
    private int maxBento;

    /** 解放済みレシピ（JSON文字列） */
    @Column(columnDefinition = "TEXT")
    @Size(max = 200000)
    private String unlockedRecipes;

    /** アクセサリー（JSON文字列） ★ 追加 */
    @Column(columnDefinition = "TEXT")
    @Size(max = 200000)
    private String accessories;

    /** ステージ別ベストタイム（JSON文字列） ★ 追加 */
    @Column(columnDefinition = "TEXT")
    @Size(max = 200000)
    private String bestTimes;

    /** 累計クリア数 ★ 追加 */
    @Min(0)
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
    @Min(0)
    @Max(1000000)
    private Integer gachaTickets;

    /** ミライ図のカケラ所持数（広場のネオンタワー点灯に使用）。
     *  gachaTickets と同じ理由でボクシング型(Integer)にしておく:
     *  既存プレイヤーの行はddl-auto=updateでカラム追加された直後はNULLになるため、
     *  プリミティブint だとgetInt()でNULLが黙って0に丸められ、フロント側の
     *  救済ロジック(data.miraiPieces ?? 0)と区別がつかなくなる問題を避ける。 */
    @Min(0)
    @Max(1000000)
    private Integer miraiPieces;

    @JsonIgnore
    @Column(name = "token_hash", length = 64)
    private String tokenHash;

    private LocalDateTime updatedAt;
}