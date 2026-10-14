use super::normalize;

#[test]
fn plain_bullets_under_action_items_become_checkboxes() {
    let md = "## Action Items\n- Reza: send the deck (Friday)\n* Sara: book the room\n";
    assert_eq!(
        normalize(md),
        "## Action Items\n- [ ] Reza: send the deck (Friday)\n- [ ] Sara: book the room\n"
    );
}

#[test]
fn numbered_items_become_checkboxes() {
    let md = "### Next steps\n1. Ship the beta\n2) Write the post";
    assert_eq!(
        normalize(md),
        "### Next steps\n- [ ] Ship the beta\n- [ ] Write the post"
    );
}

#[test]
fn existing_checkboxes_and_ticks_are_kept() {
    let md = "## Tasks\n- [ ] open\n- [x] done\n* [X] also done\n[ ] bare\n☐ boxed";
    assert_eq!(
        normalize(md),
        "## Tasks\n- [ ] open\n- [x] done\n- [x] also done\n- [ ] bare\n- [ ] boxed"
    );
}

#[test]
fn other_sections_are_untouched() {
    let md = "## Decisions\n- Launch in November\n\n## Action items\n- Reza: migrate the API\n\n## Risks\n- Staging keys";
    assert_eq!(
        normalize(md),
        "## Decisions\n- Launch in November\n\n## Action items\n- [ ] Reza: migrate the API\n\n## Risks\n- Staging keys"
    );
}

#[test]
fn deeper_headings_stay_inside_the_task_section() {
    let md = "## Action items\n### Sara\n- write copy\n## Notes\n- not a task";
    assert_eq!(
        normalize(md),
        "## Action items\n### Sara\n- [ ] write copy\n## Notes\n- not a task"
    );
}

#[test]
fn bold_line_heading_counts() {
    let md = "Summary text.\n\n**Action Items:**\n- call the vendor\n\n## Decisions\n- none yet";
    assert_eq!(
        normalize(md),
        "Summary text.\n\n**Action Items:**\n- [ ] call the vendor\n\n## Decisions\n- none yet"
    );
    assert!(normalize("**Follow-ups**:\n- ping Lea").ends_with("- [ ] ping Lea"));
}

#[test]
fn persian_headings_are_recognised() {
    let md = "## کارهای اقدام\n- رضا: ارسال اسلایدها\n## تصمیم‌ها\n- عرضه در آبان";
    assert_eq!(
        normalize(md),
        "## کارهای اقدام\n- [ ] رضا: ارسال اسلایدها\n## تصمیم‌ها\n- عرضه در آبان"
    );
}

#[test]
fn nested_lines_and_empty_notes_are_kept() {
    let md = "## Action Items\n- Reza: migration\n  - needs staging keys\n- None noted in this section.\nNo other items.";
    assert_eq!(
        normalize(md),
        "## Action Items\n- [ ] Reza: migration\n  - needs staging keys\n- None noted in this section.\nNo other items."
    );
}

#[test]
fn task_table_becomes_checklist() {
    let md = "## Action Items\n| **Owner** | **Task** | **Due** | **Reference** | **Timestamp** |\n| --- | --- | --- | --- | --- |\n| Reza | Migrate the API | Oct 15 | \"I'll take it\" | 18:40 |\n| — | Book a room | — | \"someone\" | [02:10] |\n\n## Risks\n| Risk | Owner |\n| --- | --- |\n| Keys | Reza |";
    assert_eq!(
        normalize(md),
        "## Action Items\n- [ ] Migrate the API · Reza · Oct 15 [18:40]\n- [ ] Book a room [02:10]\n\n## Risks\n| Risk | Owner |\n| --- | --- |\n| Keys | Reza |"
    );
}

#[test]
fn persian_table_and_unknown_columns() {
    let md = "## اقدام‌ها\n| مسئول | کار | مهلت |\n|:--|:--|:--|\n| سارا | نوشتن متن | جمعه |";
    assert_eq!(normalize(md), "## اقدام‌ها\n- [ ] نوشتن متن · سارا · جمعه");
    let md = "## Tasks\n| Item | Notes |\n| --- | --- |\n| Ship | after QA |";
    assert_eq!(normalize(md), "## Tasks\n- [ ] Ship · after QA");
}

#[test]
fn code_fences_are_left_alone() {
    let md = "## Action items\n```\n- not touched\n```\n- touched";
    assert_eq!(
        normalize(md),
        "## Action items\n```\n- not touched\n```\n- [ ] touched"
    );
}

#[test]
fn hashtag_without_space_is_not_a_heading() {
    let md = "#tasks\n- just a bullet";
    assert_eq!(normalize(md), md);
}
