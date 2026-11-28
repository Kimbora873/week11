// /todos 라우터 — CRUD 전체
const express = require("express");
const pool = require("../db");
const router = express.Router();

// [R] 목록 조회 (+ 실습 5: 완료/미완료 필터)
// /todos            → 전체
// /todos?filter=active → 미완료만
// /todos?filter=done   → 완료만
router.get("/", async (req, res, next) => {
  try {
    const filter = req.query.filter || "all";

    let sql = "SELECT * FROM todos";
    if (filter === "active") sql += " WHERE done = FALSE";
    if (filter === "done") sql += " WHERE done = TRUE";
    sql += " ORDER BY COALESCE(start_date, due_date) IS NULL, COALESCE(start_date, due_date), due_date, created_at DESC";

    const [
      [todos],
      [statsRows],
      [todayTodos],
    ] = await Promise.all([
      pool.query(sql),
      pool.query(
        "SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN done = TRUE THEN 1 ELSE 0 END), 0) AS done, COALESCE(SUM(CASE WHEN done = FALSE THEN 1 ELSE 0 END), 0) AS active FROM todos"
      ),
      pool.query(
        "SELECT * FROM todos WHERE (start_date IS NOT NULL AND due_date IS NOT NULL AND CURDATE() BETWEEN start_date AND due_date) OR (start_date IS NULL AND due_date = CURDATE()) OR (due_date IS NULL AND start_date = CURDATE()) ORDER BY done ASC, priority DESC, created_at DESC"
      ),
    ]);

    const rawStats = statsRows[0] || { total: 0, done: 0, active: 0 };
    const stats = {
      total: Number(rawStats.total) || 0,
      done: Number(rawStats.done) || 0,
      active: Number(rawStats.active) || 0,
    };

    res.render("todos", { todos, filter, stats, todayTodos });
  } catch (err) {
    next(err);
  }
});

function parsePriority(raw) {
  const num = Number(raw);
  return [1, 2, 3].includes(num) ? num : 2;
}

function normalizeDateRange(rawStart, rawDue) {
  let startDate = rawStart || null;
  let dueDate = rawDue || null;
  if (startDate && dueDate && startDate > dueDate) {
    [startDate, dueDate] = [dueDate, startDate];
  }
  return { startDate, dueDate };
}

// [C] 등록: 폼 POST → INSERT → 목록으로 redirect (실습 2)
router.post("/", async (req, res, next) => {
  try {
    const title = (req.body.title || "").trim();
    const { startDate, dueDate } = normalizeDateRange(
      req.body.start_date,
      req.body.due_date
    );
    const priority = parsePriority(req.body.priority);

    if (title === "") return res.redirect("/todos");

    await pool.query(
      "INSERT INTO todos (title, start_date, due_date, priority) VALUES (?, ?, ?, ?)",
      [title, startDate, dueDate, priority]
    );
    res.redirect("/todos"); // 새로고침해도 중복 등록 안 되도록 redirect
  } catch (err) {
    next(err);
  }
});

// [U] 완료/미완료 토글 (실습 3)
router.post("/:id/toggle", async (req, res, next) => {
  try {
    await pool.query("UPDATE todos SET done = NOT done WHERE id = ?", [
      req.params.id,
    ]);
    res.redirect("/todos");
  } catch (err) {
    next(err);
  }
});

// [U] 수정 폼 보여주기 (실습 3)
router.get("/:id/edit", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM todos WHERE id = ?", [
      req.params.id,
    ]);
    if (rows.length === 0) return res.redirect("/todos");
    res.render("edit", { todo: rows[0] });
  } catch (err) {
    next(err);
  }
});

// [U] 제목·시작일·마감일·중요도 수정 (실습 3)
router.post("/:id/edit", async (req, res, next) => {
  try {
    const title = (req.body.title || "").trim();
    const { startDate, dueDate } = normalizeDateRange(
      req.body.start_date,
      req.body.due_date
    );
    const priority = parsePriority(req.body.priority);
    if (title !== "") {
      await pool.query(
        "UPDATE todos SET title = ?, start_date = ?, due_date = ?, priority = ? WHERE id = ?",
        [title, startDate, dueDate, priority, req.params.id]
      );
    }
    res.redirect("/todos");
  } catch (err) {
    next(err);
  }
});

// [D] 삭제 (실습 4)
router.post("/:id/delete", async (req, res, next) => {
  try {
    await pool.query("DELETE FROM todos WHERE id = ?", [req.params.id]);
    res.redirect("/todos");
  } catch (err) {
    next(err);
  }
});

module.exports = router;
