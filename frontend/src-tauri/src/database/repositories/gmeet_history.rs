//! Whether the companion extension has ever fed a meeting. Captions only
//! arrive through the extension, so one row proves it was installed, even for
//! users who set it up before the app started remembering when it last saw it.

use sqlx::SqlitePool;

pub struct GmeetHistoryRepository;

impl GmeetHistoryRepository {
    /// True once any Google Meet caption was stored. A missing table (a
    /// database older than the gmeet migrations) reads as false.
    pub async fn has_captions(pool: &SqlitePool) -> bool {
        sqlx::query_scalar::<_, i64>("SELECT EXISTS(SELECT 1 FROM gmeet_captions)")
            .fetch_one(pool)
            .await
            .map(|found| found != 0)
            .unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::GmeetHistoryRepository;

    async fn pool() -> sqlx::SqlitePool {
        sqlx::SqlitePool::connect("sqlite::memory:")
            .await
            .expect("in-memory database")
    }

    #[tokio::test]
    async fn no_table_means_no_history() {
        assert!(!GmeetHistoryRepository::has_captions(&pool().await).await);
    }

    #[tokio::test]
    async fn a_stored_caption_counts_as_history() {
        let pool = pool().await;
        sqlx::query("CREATE TABLE gmeet_captions (id INTEGER PRIMARY KEY, text TEXT)")
            .execute(&pool)
            .await
            .expect("create table");
        assert!(!GmeetHistoryRepository::has_captions(&pool).await);
        sqlx::query("INSERT INTO gmeet_captions (text) VALUES ('hi')")
            .execute(&pool)
            .await
            .expect("insert");
        assert!(GmeetHistoryRepository::has_captions(&pool).await);
    }
}
