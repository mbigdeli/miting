use super::*;
use sqlx::sqlite::SqlitePoolOptions;

pub(crate) async fn pool() -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("open in-memory sqlite");
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("migrate");
    for id in ["m1", "m2"] {
        sqlx::query("INSERT INTO meetings (id, title, created_at, updated_at) VALUES (?, 'T', 'now', 'now')")
            .bind(id)
            .execute(&pool)
            .await
            .unwrap();
    }
    pool
}

fn card(id: &str, at: Option<f64>, body: &str) -> NoteCard {
    NoteCard {
        id: id.into(),
        at_sec: at,
        body_html: body.into(),
        quotes: vec![],
        source: "user".into(),
        edited: false,
    }
}

#[tokio::test]
async fn lists_cards_in_time_order_with_timeless_last() {
    let pool = pool().await;
    let cards = [
        card("c", None, "later"),
        card("b", Some(66.0), "two"),
        card("a", Some(39.0), "one"),
    ];
    NoteCardsRepository::upsert_many(&pool, "m1", &cards)
        .await
        .unwrap();
    let ids: Vec<String> = NoteCardsRepository::list(&pool, "m1")
        .await
        .unwrap()
        .into_iter()
        .map(|c| c.id)
        .collect();
    assert_eq!(ids, ["a", "b", "c"]);
}

#[tokio::test]
async fn upsert_updates_text_quotes_and_edited_but_keeps_the_moment() {
    let pool = pool().await;
    NoteCardsRepository::upsert(&pool, "m1", &card("a", Some(39.0), "<b>Safari</b> bug"))
        .await
        .unwrap();
    let mut edited = card("a", Some(999.0), "Safari bug, confirm");
    edited.edited = true;
    edited.quotes = vec![Quote {
        quote: "keyboard opens".into(),
        at: 39.0,
    }];
    NoteCardsRepository::upsert(&pool, "m1", &edited)
        .await
        .unwrap();
    let got = NoteCardsRepository::list(&pool, "m1").await.unwrap();
    assert_eq!(got.len(), 1);
    assert_eq!(got[0].body_html, "Safari bug, confirm");
    assert_eq!(
        got[0].at_sec,
        Some(39.0),
        "the moment a note was written never moves"
    );
    assert!(got[0].edited);
    assert_eq!(got[0].quotes[0].quote, "keyboard opens");
}

#[tokio::test]
async fn delete_only_touches_its_own_miting() {
    let pool = pool().await;
    NoteCardsRepository::upsert(&pool, "m1", &card("a", Some(1.0), "x"))
        .await
        .unwrap();
    NoteCardsRepository::delete(&pool, "m2", "a").await.unwrap();
    assert_eq!(
        NoteCardsRepository::list(&pool, "m1").await.unwrap().len(),
        1
    );
    NoteCardsRepository::delete(&pool, "m1", "a").await.unwrap();
    assert!(NoteCardsRepository::list(&pool, "m1")
        .await
        .unwrap()
        .is_empty());
}

#[tokio::test]
async fn deleting_the_miting_deletes_its_cards() {
    let pool = pool().await;
    NoteCardsRepository::upsert(&pool, "m1", &card("a", Some(1.0), "x"))
        .await
        .unwrap();
    sqlx::query("DELETE FROM meetings WHERE id = 'm1'")
        .execute(&pool)
        .await
        .unwrap();
    let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM meeting_note_cards")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(n, 0);
}

#[test]
fn card_json_uses_camel_case_and_defaults() {
    let c: NoteCard = serde_json::from_str(r#"{"id":"a","atSec":12.5,"bodyHtml":"hi"}"#).unwrap();
    assert_eq!(c.source, "user");
    assert!(c.quotes.is_empty() && !c.edited);
    assert!(serde_json::to_string(&c).unwrap().contains("\"bodyHtml\""));
}
