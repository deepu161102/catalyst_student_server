const SatAssignment             = require('../../models/sat/SatAssignment');
const SatExamConfig             = require('../../models/sat/SatExamConfig');
const SatFullLengthExamConfig   = require('../../models/sat/SatFullLengthExamConfig');
const SatPracticeTestConfig     = require('../../models/sat/SatPracticeTestConfig');
const SatTestSession            = require('../../models/sat/SatTestSession');
const SatFullLengthSession      = require('../../models/sat/SatFullLengthSession');
const SatPracticeSession        = require('../../models/sat/SatPracticeSession');
const SatQuestionBank           = require('../../models/sat/SatQuestionBank');
const Student                   = require('../../models/Student');

// ── GET /api/sat/mentor/exam-configs ──────────────────────────────────────────
// Returns all active assignable tests (subject/diagnostic/mock + full length + practice)
const listAvailableTests = async (req, res) => {
  try {
    const [subjectTests, fullLengthTests, practiceTests] = await Promise.all([
      SatExamConfig.find({ is_active: true })
        .select('name subject type adaptive_threshold module_1 module_2_hard module_2_easy')
        .sort({ subject: 1, name: 1 })
        .lean(),
      SatFullLengthExamConfig.find({ is_active: true })
        .populate('math_exam_config_id', 'name subject type')
        .populate('rw_exam_config_id',   'name subject type')
        .sort({ name: 1 })
        .lean(),
      SatPracticeTestConfig.find({ is_active: true })
        .select('name subject topic sub_topic total_questions time_limit_minutes difficulty_distribution')
        .sort({ display_order: 1, name: 1 })
        .lean(),
    ]);

    res.json({
      success: true,
      data: { subject_tests: subjectTests, full_length_tests: fullLengthTests, practice_tests: practiceTests },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── POST /api/sat/mentor/assign ───────────────────────────────────────────────
const assignTest = async (req, res) => {
  try {
    const { student_id, test_type, exam_config_id, full_length_exam_config_id, practice_config_id, due_date } = req.body;

    if (!student_id) return res.status(400).json({ success: false, message: 'student_id is required' });
    if (!['subject', 'full_length', 'practice'].includes(test_type)) {
      return res.status(400).json({ success: false, message: 'test_type must be subject, full_length, or practice' });
    }

    const student = await Student.findById(student_id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    if (test_type === 'subject') {
      if (!exam_config_id) return res.status(400).json({ success: false, message: 'exam_config_id is required' });
      const config = await SatExamConfig.findById(exam_config_id);
      if (!config || !config.is_active) return res.status(404).json({ success: false, message: 'Exam config not found or inactive' });
    } else if (test_type === 'full_length') {
      if (!full_length_exam_config_id) return res.status(400).json({ success: false, message: 'full_length_exam_config_id is required' });
      const config = await SatFullLengthExamConfig.findById(full_length_exam_config_id);
      if (!config || !config.is_active) return res.status(404).json({ success: false, message: 'Full length config not found or inactive' });
    } else {
      if (!practice_config_id) return res.status(400).json({ success: false, message: 'practice_config_id is required' });
      const config = await SatPracticeTestConfig.findById(practice_config_id);
      if (!config || !config.is_active) return res.status(404).json({ success: false, message: 'Practice config not found or inactive' });
    }

    const assignment = await SatAssignment.create({
      assigned_by:                req.userId,
      assigned_by_role:           req.userRole,
      student_id,
      test_type,
      exam_config_id:             test_type === 'subject'      ? exam_config_id             : undefined,
      full_length_exam_config_id: test_type === 'full_length'  ? full_length_exam_config_id : undefined,
      practice_config_id:         test_type === 'practice'     ? practice_config_id         : undefined,
      due_date:                   due_date || undefined,
    });

    res.status(201).json({ success: true, data: assignment });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ── POST /api/sat/mentor/assign/batch ─────────────────────────────────────────
const assignBatch = async (req, res) => {
  try {
    const { student_ids, test_type, exam_config_id, full_length_exam_config_id, practice_config_id, due_date } = req.body;

    if (!Array.isArray(student_ids) || !student_ids.length) {
      return res.status(400).json({ success: false, message: 'student_ids array is required' });
    }
    if (!['subject', 'full_length', 'practice'].includes(test_type)) {
      return res.status(400).json({ success: false, message: 'test_type must be subject, full_length, or practice' });
    }

    const docs = student_ids.map((sid) => ({
      assigned_by:                req.userId,
      assigned_by_role:           req.userRole,
      student_id:                 sid,
      test_type,
      exam_config_id:             test_type === 'subject'     ? exam_config_id             : undefined,
      full_length_exam_config_id: test_type === 'full_length' ? full_length_exam_config_id : undefined,
      practice_config_id:         test_type === 'practice'    ? practice_config_id         : undefined,
      due_date:                   due_date || undefined,
    }));

    const assignments = await SatAssignment.insertMany(docs, { ordered: false });
    res.status(201).json({ success: true, count: assignments.length, data: assignments });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ── GET /api/sat/mentor/assignments ───────────────────────────────────────────
const getMyAssignments = async (req, res) => {
  try {
    const filter = { assigned_by: req.userId, is_active: true };
    if (req.query.status)     filter.status     = req.query.status;
    if (req.query.student_id) filter.student_id = req.query.student_id;

    const assignments = await SatAssignment.find(filter)
      .populate('student_id',                 'name email')
      .populate('exam_config_id',             'name subject type')
      .populate('full_length_exam_config_id', 'name')
      .populate('practice_config_id',         'name subject topic sub_topic')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, count: assignments.length, data: assignments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/sat/mentor/assignments/:id/results ───────────────────────────────
const getAssignmentResults = async (req, res) => {
  try {
    const assignment = await SatAssignment.findById(req.params.id)
      .populate('student_id',                 'name email')
      .populate('exam_config_id',             'name subject type')
      .populate('full_length_exam_config_id', 'name')
      .populate('practice_config_id',         'name subject topic sub_topic')
      .lean();
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

    const buildBreakdown = (answers, questionMap) =>
      (answers || []).map(a => {
        const q = questionMap[a.question_id?.toString()];
        return {
          question_id:    a.question_id,
          stem:           q?.stem,
          option_a:       q?.option_a,
          option_b:       q?.option_b,
          option_c:       q?.option_c,
          option_d:       q?.option_d,
          topic:          q?.topic,
          sub_topic:      q?.sub_topic,
          difficulty:     q?.difficulty,
          points:         q?.points,
          selected:       a.selected,
          correct_answer: q?.correct_answer,
          is_correct:     a.is_correct,
          explanation:    q?.explanation,
        };
      });

    const enrichSession = async (session) => {
      const allIds = [
        ...(session.module_1?.question_ids || []),
        ...(session.module_2?.question_ids || []),
      ];
      const questions   = await SatQuestionBank.find({ _id: { $in: allIds } }).lean();
      const questionMap = Object.fromEntries(questions.map(q => [q._id.toString(), q]));
      return {
        session_id:  session._id,
        subject:     session.subject,
        status:      session.status,
        total_score: session.total_score,
        module_1: {
          score:      session.module_1?.score,
          max_score:  session.module_1?.max_score,
          percentage: session.module_1?.percentage,
          breakdown:  buildBreakdown(session.module_1?.answers, questionMap),
        },
        module_2: session.module_2?.answers?.length ? {
          tier:       session.module_2.tier,
          score:      session.module_2.score,
          max_score:  session.module_2.max_score,
          percentage: session.module_2.percentage,
          breakdown:  buildBreakdown(session.module_2.answers, questionMap),
        } : null,
      };
    };

    let sessionData = null;

    if (assignment.test_type === 'practice' && assignment.session_id) {
      const raw = await SatPracticeSession.findById(assignment.session_id).lean();
      if (raw) {
        const questions   = await SatQuestionBank.find({ _id: { $in: raw.question_ids } }).lean();
        const questionMap = Object.fromEntries(questions.map(q => [q._id.toString(), q]));
        sessionData = {
          session_id:  raw._id,
          status:      raw.status,
          score:       raw.score,
          max_score:   raw.max_score,
          percentage:  raw.percentage,
          breakdown:   buildBreakdown(raw.answers, questionMap),
        };
      }
    } else if (assignment.test_type === 'subject' && assignment.session_id) {
      const raw = await SatTestSession.findById(assignment.session_id).lean();
      if (raw) sessionData = await enrichSession(raw);
    } else if (assignment.test_type === 'full_length' && assignment.session_id) {
      const flRaw = await SatFullLengthSession.findById(assignment.session_id).lean();
      if (flRaw) {
        const [mathRaw, rwRaw] = await Promise.all([
          flRaw.math_session_id ? SatTestSession.findById(flRaw.math_session_id).lean() : null,
          flRaw.rw_session_id   ? SatTestSession.findById(flRaw.rw_session_id).lean()   : null,
        ]);
        sessionData = {
          session_id:  flRaw._id,
          status:      flRaw.status,
          total_score: flRaw.total_score,
          math: mathRaw ? await enrichSession(mathRaw) : null,
          rw:   rwRaw   ? await enrichSession(rwRaw)   : null,
        };
      }
    }

    res.json({ success: true, data: { assignment, session: sessionData } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/sat/test/assignments (student) ───────────────────────────────────
const getStudentAssignments = async (req, res) => {
  try {
    const assignments = await SatAssignment.find({
      student_id: req.userId,
      is_active:  true,
    })
      .populate('exam_config_id',             'name subject type module_1')
      .populate('full_length_exam_config_id', 'name')
      .populate('practice_config_id',         'name subject topic sub_topic total_questions time_limit_minutes')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, count: assignments.length, data: assignments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/sat/mentor/student/:studentId/sessions ──────────────────────────
const getStudentAdaptiveSessions = async (req, res) => {
  try {
    const studentId = req.params.studentId;

    // Standalone subject sessions — NOT part of any full-length test
    // Using `null` instead of `$exists: false` because in MongoDB `{ field: null }` matches
    // both documents where the field is absent AND where it is explicitly null, which is
    // more robust in case the field was ever stored as null rather than omitted entirely.
    const subjectSessions = await SatTestSession
      .find({ student_id: studentId, full_length_session_id: null })
      .populate('exam_config_id', 'name subject type')
      .select('_id exam_config_id subject status total_score module_1.score module_1.max_score module_2.score module_2.max_score createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const subjectData = subjectSessions.map(s => {
      const totalMax   = (s.module_1?.max_score || 0) + (s.module_2?.max_score || 0);
      const totalScore = (s.module_1?.score     || 0) + (s.module_2?.score     || 0);
      return { ...s, session_type: 'subject', total_percentage: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0 };
    });

    // Full-length sessions — grouped as one entry per full-length test
    const fullLengthSessions = await SatFullLengthSession
      .find({ student_id: studentId })
      .populate({ path: 'full_length_exam_config_id', select: 'name math_exam_config_id', populate: { path: 'math_exam_config_id', select: 'type' } })
      .select('_id full_length_exam_config_id status total_score math_session_id rw_session_id createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const fullLengthData = fullLengthSessions.map(fl => {
      const flConfig   = fl.full_length_exam_config_id;
      const configType = flConfig?.math_exam_config_id?.type || 'mock';
      return {
        _id:                        fl._id,
        session_type:               'full_length',
        full_length_exam_config_id: { _id: flConfig?._id, name: flConfig?.name },
        exam_config_id:             { type: configType },
        status:                     fl.status,
        total_score:                fl.total_score,
        math_session_id:            fl.math_session_id,
        rw_session_id:              fl.rw_session_id,
        createdAt:                  fl.createdAt,
      };
    });

    const data = [...subjectData, ...fullLengthData].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/sat/mentor/student/:studentId/practice-sessions ─────────────────
const getStudentPracticeSessions = async (req, res) => {
  try {
    const data = await SatPracticeSession
      .find({ student_id: req.params.studentId })
      .populate('practice_config_id', 'name subject topic sub_topic')
      .select('_id practice_config_id subject sub_topic status score max_score percentage createdAt')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/sat/mentor/sessions/:sessionId/results ──────────────────────────
const getAdaptiveSessionResults = async (req, res) => {
  try {
    const session = await SatTestSession.findById(req.params.sessionId)
      .populate('exam_config_id', 'name subject type')
      .lean();
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    const allIds      = [...(session.module_1?.question_ids || []), ...(session.module_2?.question_ids || [])];
    const questions   = await SatQuestionBank.find({ _id: { $in: allIds } }).lean();
    const questionMap = Object.fromEntries(questions.map(q => [q._id.toString(), q]));

    const buildBreakdown = (answers) =>
      (answers || []).map(a => {
        const q = questionMap[a.question_id?.toString()];
        return {
          question_id: a.question_id, stem: q?.stem,
          option_a: q?.option_a, option_b: q?.option_b, option_c: q?.option_c, option_d: q?.option_d,
          topic: q?.topic, sub_topic: q?.sub_topic, difficulty: q?.difficulty, points: q?.points,
          selected: a.selected, correct_answer: q?.correct_answer, is_correct: a.is_correct, explanation: q?.explanation,
        };
      });

    res.json({
      success: true,
      data: {
        session_id:     session._id,
        subject:        session.subject,
        status:         session.status,
        total_score:    session.total_score,
        exam_config_id: session.exam_config_id,
        module_1: {
          score: session.module_1?.score, max_score: session.module_1?.max_score,
          percentage: session.module_1?.percentage, breakdown: buildBreakdown(session.module_1?.answers),
        },
        module_2: session.module_2?.answers?.length ? {
          tier: session.module_2.tier, score: session.module_2.score,
          max_score: session.module_2.max_score, percentage: session.module_2.percentage,
          breakdown: buildBreakdown(session.module_2.answers),
        } : null,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/sat/mentor/practice-sessions/:sessionId/results ─────────────────
const getPracticeSessionResults = async (req, res) => {
  try {
    const session = await SatPracticeSession.findById(req.params.sessionId)
      .populate('practice_config_id', 'name subject topic sub_topic')
      .lean();
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    const questions   = await SatQuestionBank.find({ _id: { $in: session.question_ids } }).lean();
    const questionMap = Object.fromEntries(questions.map(q => [q._id.toString(), q]));

    const breakdown = (session.answers || []).map(a => {
      const q = questionMap[a.question_id?.toString()];
      return {
        question_id: a.question_id, stem: q?.stem,
        option_a: q?.option_a, option_b: q?.option_b, option_c: q?.option_c, option_d: q?.option_d,
        topic: q?.topic, sub_topic: q?.sub_topic, difficulty: q?.difficulty, points: q?.points,
        selected: a.selected, correct_answer: q?.correct_answer, is_correct: a.is_correct, explanation: q?.explanation,
      };
    });

    res.json({
      success: true,
      data: {
        session_id:         session._id,
        practice_config_id: session.practice_config_id,
        status:             session.status,
        score:              session.score,
        max_score:          session.max_score,
        percentage:         session.percentage,
        breakdown,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/sat/mentor/full-length-sessions/:sessionId/results ───────────────
const getFullLengthSessionResults = async (req, res) => {
  try {
    const fl = await SatFullLengthSession.findById(req.params.sessionId)
      .populate('full_length_exam_config_id', 'name')
      .lean();
    if (!fl) return res.status(404).json({ success: false, message: 'Session not found' });

    const buildBreakdown = (answers, questionMap) =>
      (answers || []).map(a => {
        const q = questionMap[a.question_id?.toString()];
        return {
          question_id: a.question_id, stem: q?.stem,
          option_a: q?.option_a, option_b: q?.option_b, option_c: q?.option_c, option_d: q?.option_d,
          topic: q?.topic, sub_topic: q?.sub_topic, difficulty: q?.difficulty, points: q?.points,
          selected: a.selected, correct_answer: q?.correct_answer, is_correct: a.is_correct, explanation: q?.explanation,
        };
      });

    const enrichSession = async (sessionId) => {
      if (!sessionId) return null;
      const session = await SatTestSession.findById(sessionId).lean();
      if (!session) return null;
      const allIds      = [...(session.module_1?.question_ids || []), ...(session.module_2?.question_ids || [])];
      const questions   = await SatQuestionBank.find({ _id: { $in: allIds } }).lean();
      const questionMap = Object.fromEntries(questions.map(q => [q._id.toString(), q]));
      return {
        session_id:  session._id,
        subject:     session.subject,
        status:      session.status,
        total_score: session.total_score,
        module_1: {
          score: session.module_1?.score, max_score: session.module_1?.max_score,
          percentage: session.module_1?.percentage, breakdown: buildBreakdown(session.module_1?.answers, questionMap),
        },
        module_2: session.module_2?.answers?.length ? {
          tier: session.module_2.tier, score: session.module_2.score,
          max_score: session.module_2.max_score, percentage: session.module_2.percentage,
          breakdown: buildBreakdown(session.module_2.answers, questionMap),
        } : null,
      };
    };

    const [mathData, rwData] = await Promise.all([
      enrichSession(fl.math_session_id),
      enrichSession(fl.rw_session_id),
    ]);

    res.json({
      success: true,
      data: {
        session_id:                 fl._id,
        full_length_exam_config_id: fl.full_length_exam_config_id,
        status:                     fl.status,
        total_score:                fl.total_score,
        math:                       mathData,
        rw:                         rwData,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  listAvailableTests,
  assignTest,
  assignBatch,
  getMyAssignments,
  getAssignmentResults,
  getStudentAssignments,
  getStudentAdaptiveSessions,
  getStudentPracticeSessions,
  getAdaptiveSessionResults,
  getPracticeSessionResults,
  getFullLengthSessionResults,
};
