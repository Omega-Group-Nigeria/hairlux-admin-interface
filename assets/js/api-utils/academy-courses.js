/**
 * academy-courses.js — Hairlux Admin
 * All /admin/academy/* calls -- Frontend Build Roadmap Phase 4 (Academy
 * Digital Courses): Courses, Pricing, Modules, Lessons (with reorder),
 * Assessments (question builder), and Review moderation.
 *
 * Requires:
 *   - config.js  (window.API_BASE)
 *   - auth.js    (Auth.fetch)
 */
const AcademyCourses = (() => {

  async function apiFetch(path, options = {}) {
    const res = await Auth.fetch(path, options);
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Request failed (${res.status})`);
    return raw.data !== undefined ? raw.data : raw;
  }

  function buildQuery(params) {
    const qs = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => { if (v !== "" && v != null) qs.set(k, v); });
    const s = qs.toString();
    return s ? "?" + s : "";
  }

  // ─── COURSES ─────────────────────────────────────────────────────────────
  // No delete endpoints anywhere in this module (Courses/Modules/Lessons) --
  // deliberate, per the backend's own append-only philosophy: a published
  // course moves to ARCHIVED rather than being removed, since a customer
  // with CourseAccess/CourseProgress against a deleted course would be left
  // dangling. Only Assessments get a DELETE (see below), because they have
  // no status field to archive with instead.

  function getCourses(filters) {
    return apiFetch("/admin/academy/courses" + buildQuery(filters));
  }
  function getCourse(id) {
    return apiFetch(`/admin/academy/courses/${id}`);
  }
  function createCourse(payload) {
    return apiFetch("/admin/academy/courses", { method: "POST", body: JSON.stringify(payload) });
  }
  function updateCourse(id, payload) {
    return apiFetch(`/admin/academy/courses/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  }
  /**
   * Bypasses apiFetch/Auth.fetch (multipart needs its own boundary
   * Content-Type) -- same pattern as uploadLessonFile below.
   * @param {File} file
   * @returns {Promise<{coverImageKey: string, coverImageUrl: string}>}
   */
  async function uploadCoverImage(file) {
    const base = (window.API_BASE || "").replace(/\/$/, "");
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch(base + "/admin/academy/courses/cover-image/upload", {
      method: "POST",
      headers: { Authorization: "Bearer " + Auth.getToken() },
      body: formData,
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Upload failed (${res.status})`);
    return raw.data !== undefined ? raw.data : raw;
  }

  // ─── PRICING ─────────────────────────────────────────────────────────────

  function getPricing(courseId) {
    return apiFetch(`/admin/academy/courses/${courseId}/pricing`);
  }
  function addPricing(courseId, payload) {
    return apiFetch(`/admin/academy/courses/${courseId}/pricing`, { method: "POST", body: JSON.stringify(payload) });
  }
  function updatePricing(pricingId, payload) {
    return apiFetch(`/admin/academy/courses/pricing/${pricingId}`, { method: "PUT", body: JSON.stringify(payload) });
  }
  function deletePricing(pricingId) {
    return apiFetch(`/admin/academy/courses/pricing/${pricingId}`, { method: "DELETE" });
  }

  // ─── MODULES ─────────────────────────────────────────────────────────────

  function createModule(courseId, payload) {
    return apiFetch(`/admin/academy/courses/${courseId}/modules`, { method: "POST", body: JSON.stringify(payload) });
  }
  function updateModule(moduleId, payload) {
    return apiFetch(`/admin/academy/courses/modules/${moduleId}`, { method: "PUT", body: JSON.stringify(payload) });
  }
  function reorderModules(courseId, orderedIds) {
    return apiFetch(`/admin/academy/courses/${courseId}/modules/reorder`, { method: "PUT", body: JSON.stringify({ orderedIds }) });
  }
  function publishModule(moduleId) {
    return apiFetch(`/admin/academy/courses/modules/${moduleId}/publish`, { method: "PUT" });
  }
  function unpublishModule(moduleId) {
    return apiFetch(`/admin/academy/courses/modules/${moduleId}/unpublish`, { method: "PUT" });
  }

  // ─── LESSONS ─────────────────────────────────────────────────────────────

  function createLesson(moduleId, payload) {
    return apiFetch(`/admin/academy/courses/modules/${moduleId}/lessons`, { method: "POST", body: JSON.stringify(payload) });
  }
  function updateLesson(lessonId, payload) {
    return apiFetch(`/admin/academy/courses/lessons/${lessonId}`, { method: "PUT", body: JSON.stringify(payload) });
  }
  function reorderLessons(moduleId, orderedIds) {
    return apiFetch(`/admin/academy/courses/modules/${moduleId}/lessons/reorder`, { method: "PUT", body: JSON.stringify({ orderedIds }) });
  }
  function publishLesson(lessonId) {
    return apiFetch(`/admin/academy/courses/lessons/${lessonId}/publish`, { method: "PUT" });
  }
  function unpublishLesson(lessonId) {
    return apiFetch(`/admin/academy/courses/lessons/${lessonId}/unpublish`, { method: "PUT" });
  }

  /**
   * Bypasses apiFetch/Auth.fetch entirely (the browser needs to set its
   * own Content-Type including the multipart boundary, which Auth.fetch's
   * forced 'application/json' default would break) -- same proven
   * pattern as the existing LMS upload (Lms.submitFormData) and
   * staff-documents.js's uploadFile.
   * @param {File} file
   * @returns {Promise<{contentKey: string}>}
   */
  async function uploadLessonFile(file) {
    const base = (window.API_BASE || "").replace(/\/$/, "");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(base + "/admin/academy/courses/lessons/upload", {
      method: "POST",
      headers: { Authorization: "Bearer " + Auth.getToken() },
      body: formData,
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Upload failed (${res.status})`);
    return raw.data !== undefined ? raw.data : raw;
  }

  // ─── ASSESSMENTS ─────────────────────────────────────────────────────────

  function getAssessment(id) {
    return apiFetch(`/admin/academy/assessments/${id}`);
  }
  function listAssessmentsForCourse(courseId) {
    return apiFetch(`/admin/academy/courses/${courseId}/assessments`);
  }
  function createAssessment(payload) {
    return apiFetch("/admin/academy/assessments", { method: "POST", body: JSON.stringify(payload) });
  }
  function updateAssessment(id, payload) {
    return apiFetch(`/admin/academy/assessments/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  }
  // DELETE assessments/:id -- Frontend Build Roadmap Phase 4 addition.
  // Unlike Course/Module/Lesson, Assessment has no status field to
  // archive with, so a mistaken/duplicate assessment could never be
  // removed at all. The backend blocks this once results exist.
  function deleteAssessment(id) {
    return apiFetch(`/admin/academy/assessments/${id}`, { method: "DELETE" });
  }

  // ─── REVIEW MODERATION ───────────────────────────────────────────────────

  function listReviews(filters) {
    return apiFetch("/admin/academy/reviews" + buildQuery(filters));
  }
  function moderateReview(id, status) {
    return apiFetch(`/admin/academy/reviews/${id}/moderate`, { method: "PUT", body: JSON.stringify({ status }) });
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────

  function formatMoney(n, currency) {
    return (currency === "USD" ? "$" : "₦") + Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 });
  }
  function formatDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
  }
  function formatDateTime(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("en-NG", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function courseStatusBadge(status) {
    const map = {
      DRAFT: "bg-secondary-lt text-secondary",
      PUBLISHED: "bg-success-lt text-success",
      UNPUBLISHED: "bg-warning-lt text-warning",
      COMING_SOON: "bg-info-lt text-info",
      ARCHIVED: "bg-secondary-lt text-secondary",
    };
    return '<span class="badge ' + (map[status] || "bg-secondary-lt") + '">' + (status || "—").replace(/_/g, " ") + "</span>";
  }
  function contentStatusBadge(status) {
    const map = { DRAFT: "bg-secondary-lt text-secondary", PUBLISHED: "bg-success-lt text-success" };
    return '<span class="badge ' + (map[status] || "bg-secondary-lt") + '">' + (status || "—") + "</span>";
  }
  function reviewStatusBadge(status) {
    const map = {
      PENDING: "bg-warning-lt text-warning",
      APPROVED: "bg-success-lt text-success",
      HIDDEN: "bg-secondary-lt text-secondary",
      DELETED: "bg-danger-lt text-danger",
    };
    return '<span class="badge ' + (map[status] || "bg-secondary-lt") + '">' + (status || "—") + "</span>";
  }
  function levelLabel(level) {
    const map = { BEGINNER: "Beginner", INTERMEDIATE: "Intermediate", ADVANCED: "Advanced", ALL: "All Levels" };
    return map[level] || level || "—";
  }
  function starRating(n) {
    if (n == null) return '<span class="text-secondary">No ratings yet</span>';
    var rounded = Math.round(n * 10) / 10;
    return '<span class="text-warning">' + "★".repeat(Math.round(n)) + '</span><span class="text-secondary">' + "☆".repeat(5 - Math.round(n)) + '</span> ' + rounded;
  }

  // ─── ASSESSMENT QUESTION BUILDER ─────────────────────────────────────────
  // Isolated, unit-tested conversion logic (editing state <-> API shape).
  // Correctness is tracked by INDEX during editing (options/answers are
  // free text being typed), converted to the API's by-TEXT
  // correctAnswers[] only when building the save payload -- see the
  // Frontend Build Roadmap's own note flagging this as the highest-risk
  // piece of new UI in the whole build.

  function defaultQuestion(type) {
    type = type || "MULTIPLE_CHOICE";
    var q = { id: null, type: type, prompt: "", points: 1 };
    if (type === "MULTIPLE_CHOICE" || type === "MULTIPLE_ANSWER") {
      q.options = ["", ""];
      q.correctIndices = [];
    } else if (type === "TRUE_FALSE") {
      q.correctBool = "true";
    } else {
      q.shortAnswers = [""];
    }
    return q;
  }

  function fromApiQuestion(apiQ) {
    var base = { id: apiQ.id || null, type: apiQ.type, prompt: apiQ.prompt || "", points: apiQ.points != null ? apiQ.points : 1 };
    if (apiQ.type === "MULTIPLE_CHOICE" || apiQ.type === "MULTIPLE_ANSWER") {
      base.options = (apiQ.options || []).slice();
      if (!base.options.length) base.options = ["", ""];
      var correctSet = {};
      (apiQ.correctAnswers || []).forEach(function (a) { correctSet[String(a).trim().toLowerCase()] = true; });
      base.correctIndices = base.options
        .map(function (o, i) { return i; })
        .filter(function (i) { return correctSet[String(base.options[i]).trim().toLowerCase()]; });
    } else if (apiQ.type === "TRUE_FALSE") {
      var v = (apiQ.correctAnswers && apiQ.correctAnswers[0]) || "true";
      base.correctBool = String(v).trim().toLowerCase() === "false" ? "false" : "true";
    } else {
      base.shortAnswers = (apiQ.correctAnswers || []).slice();
      if (!base.shortAnswers.length) base.shortAnswers = [""];
    }
    return base;
  }

  function toApiQuestion(q) {
    var prompt = (q.prompt || "").trim();
    if (!prompt) return { question: null, error: "Every question needs a prompt." };
    var pointsRaw = q.points;
    var points = (pointsRaw === "" || pointsRaw === null || pointsRaw === undefined) ? NaN : Number(pointsRaw);
    if (!(points >= 0)) points = 1;
    var base = { type: q.type, prompt: prompt, points: points };
    if (q.id) base.id = q.id;

    if (q.type === "MULTIPLE_CHOICE" || q.type === "MULTIPLE_ANSWER") {
      var options = (q.options || []).map(function (o) { return (o || "").trim(); }).filter(Boolean);
      if (options.length < 2) return { question: null, error: 'A "' + q.type + '" question needs at least 2 options.' };
      var correctTexts = (q.correctIndices || [])
        .map(function (i) { return (q.options || [])[i]; })
        .filter(Boolean)
        .map(function (o) { return o.trim(); })
        .filter(function (o) { return options.indexOf(o) !== -1; });
      if (!correctTexts.length) return { question: null, error: 'Mark at least one correct answer for "' + prompt + '".' };
      if (q.type === "MULTIPLE_CHOICE" && correctTexts.length > 1) {
        return { question: null, error: 'A "MULTIPLE_CHOICE" question can only have one correct answer -- use "MULTIPLE_ANSWER" for more than one.' };
      }
      base.options = options;
      base.correctAnswers = correctTexts;
    } else if (q.type === "TRUE_FALSE") {
      base.correctAnswers = [q.correctBool === "false" ? "false" : "true"];
    } else {
      var shortAnswers = (q.shortAnswers || []).map(function (a) { return (a || "").trim(); }).filter(Boolean);
      if (!shortAnswers.length) return { question: null, error: 'Give at least one acceptable answer for "' + prompt + '".' };
      base.correctAnswers = shortAnswers;
    }
    return { question: base, error: null };
  }

  function buildQuestionsPayload(editingQuestions) {
    var questions = [];
    var errors = [];
    (editingQuestions || []).forEach(function (q, idx) {
      var result = toApiQuestion(q);
      if (result.error) errors.push("Question " + (idx + 1) + ": " + result.error);
      else questions.push(result.question);
    });
    if (!editingQuestions || !editingQuestions.length) errors.unshift("Add at least one question.");
    return { questions: questions, errors: errors };
  }

  return {
    getCourses, getCourse, createCourse, updateCourse, uploadCoverImage,
    getPricing, addPricing, updatePricing, deletePricing,
    createModule, updateModule, reorderModules, publishModule, unpublishModule,
    createLesson, updateLesson, reorderLessons, publishLesson, unpublishLesson, uploadLessonFile,
    getAssessment, listAssessmentsForCourse, createAssessment, updateAssessment, deleteAssessment,
    listReviews, moderateReview,
    formatMoney, formatDate, formatDateTime,
    courseStatusBadge, contentStatusBadge, reviewStatusBadge, levelLabel, starRating,
    defaultQuestion, fromApiQuestion, toApiQuestion, buildQuestionsPayload,
  };
})();
