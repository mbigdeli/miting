use super::*;
use crate::database::repositories::note_cards::tests::pool;

fn msg(id: &str, q: &str) -> AskMessage {
    AskMessage {
        id: id.into(),
        asked_at_sec: Some(92.0),
        question: q.into(),
        quotes: vec![Quote {
            quote: "96 dollars".into(),
            at: 84.0,
        }],
        answer_md: Some("Finance proposes $96 [01:24].".into()),
        citations: vec![84.0],
        error: None,
        provider: Some("claude".into()),
        model: Some("sonnet".into()),
        saved_note_id: None,
    }
}

#[tokio::test]
async fn keeps_the_conversation_in_the_order_asked() {
    let pool = pool().await;
    AskMessagesRepository::insert_many(&pool, "m1", &[msg("a", "first"), msg("b", "second")])
        .await
        .unwrap();
    AskMessagesRepository::insert_many(&pool, "m1", &[msg("c", "third")])
        .await
        .unwrap();
    let got = AskMessagesRepository::list(&pool, "m1").await.unwrap();
    let qs: Vec<&str> = got.iter().map(|m| m.question.as_str()).collect();
    assert_eq!(qs, ["first", "second", "third"]);
    assert_eq!(got[0].quotes[0].at, 84.0);
    assert_eq!(got[0].citations, vec![84.0]);
}

#[tokio::test]
async fn importing_twice_does_not_duplicate() {
    let pool = pool().await;
    AskMessagesRepository::insert_many(&pool, "m1", &[msg("a", "q")])
        .await
        .unwrap();
    AskMessagesRepository::insert_many(&pool, "m1", &[msg("a", "q")])
        .await
        .unwrap();
    assert_eq!(
        AskMessagesRepository::list(&pool, "m1")
            .await
            .unwrap()
            .len(),
        1
    );
}

#[tokio::test]
async fn remembers_the_saved_note() {
    let pool = pool().await;
    AskMessagesRepository::insert_many(&pool, "m1", &[msg("a", "q")])
        .await
        .unwrap();
    AskMessagesRepository::set_saved_note(&pool, "m2", "a", "n9")
        .await
        .unwrap();
    assert_eq!(
        AskMessagesRepository::list(&pool, "m1").await.unwrap()[0].saved_note_id,
        None
    );
    AskMessagesRepository::set_saved_note(&pool, "m1", "a", "n1")
        .await
        .unwrap();
    assert_eq!(
        AskMessagesRepository::list(&pool, "m1").await.unwrap()[0]
            .saved_note_id
            .as_deref(),
        Some("n1")
    );
}

#[tokio::test]
async fn conversations_are_per_miting() {
    let pool = pool().await;
    AskMessagesRepository::insert_many(&pool, "m1", &[msg("a", "q")])
        .await
        .unwrap();
    assert!(AskMessagesRepository::list(&pool, "m2")
        .await
        .unwrap()
        .is_empty());
}
