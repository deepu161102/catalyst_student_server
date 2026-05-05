const SatAssignment             = require('../../models/sat/SatAssignment');
const SatExamConfig             = require('../../models/sat/SatExamConfig');
const SatFullLengthExamConfig   = require('../../models/sat/SatFullLengthExamConfig');
const SatTestSession            = require('../../models/sat/SatTestSession');
const SatFullLengthSession      = require('../../models/sat/SatFullLengthSession');
const Student                   = require('../../models/Student');

// ── GET /api/sat/mentor/exam-configs ──────────────────────────────────────────
// Returns all active assignable tests (subject + full length)
const listAvailableTests = async (req, res) => {
  try {
    const [subjectTests, fullLengthTests] = await Promise.all([
      SatExamConfig.find({ is_active: true }).select('name subject adaptive_threshold module_1 module_2_hard module_2_easy').sort({ subject: 1, name: 1 }).lean(),
      SatFullLengthExamConfig.find({ is_active: true })
        .populate('math_exam_config_id', 'name subject')
        .populate('rw_exam_config_id',   'name subject')
        .sort({ name: 1 })
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        subject_tests:      subjectTests,
        full_length_tests:  fullLengthTests,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── POST /api/sat/mentor/assign ───────────────────────────────────────────────
// Body: { student_id, test_type, exam_config_id | full_length_exam_config_id, due_date? }
const assignTest = async (req, res) => {
  try {
    const { student_id, test_type, exam_config_id, full_length_exam_config_id, due_date } = req.body;

    if (!student_id) return res.status(400).json({ success: false, message: 'student_id is required' });
    if (!['subject', 'full_length'].includes(test_type)) return res.status(400).json({ success: false, message: 'test_type must be subject or full_length' });

    const student = await Student.findById(student_id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    if (test_type === 'subject') {
      if (!exam_config_id) return res.status(400).json({ success: false, message: 'exam_config_id is required for subject test' });
      const config = await SatExamConfig.findById(exam_config_id);
      if (!config || !config.is_active) return res.status(404).json({ success: false, message: 'Exam config not found or inactive' });
    } else {
      if (!full_length_exam_config_id) return res.status(400).json({ success: false, message: 'full_length_exam_config_id is required for full length test' });
      const config = await SatFullLengthExamConfig.findById(full_length_exam_config_id);
      if (!config || !config.is_active) return res.status(404).json({ success: false, message: 'Full length config not found or inactive' });
    }

    const assignment = await SatAssignment.create({
      assigned_by:                req.userId,
      assigned_by_role:           req.userRole,
      student_id,
      test_type,
      exam_config_id:             test_type === 'subject'      ? exam_config_id             : undefined,
      full_length_exam_config_id: test_type === 'full_length'  ? full_length_exam_config_id : undefined,
      due_date:                   due_date || undefined,
    });

    res.status(201).json({ success: true, data: assignment });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ── POST /api/sat/mentor/assign/batch ─────────────────────────────────────────
// Assign the same test to multiple students at once
// Body: { student_ids[], test_type, exam_config_id | full_length_exam_config_id, due_date? }
const assignBatch = async (req, res) => {
  try {
    const { student_ids, test_type, exam_config_id, full_length_exam_config_id, due_date } = req.body;

    if (!Array.isArray(student_ids) || !student_ids.length) {
      return res.status(400).json({ success: false, message: 'student_ids array is required' });
    }
    if (!['subject', 'full_length'].includes(test_type)) {
      return res.status(400).json({ success: false, message: 'test_type must be subject or full_length' });
    }

    const docs = student_ids.map((sid) => ({
      assigned_by:                req.userId,
      assigned_by_role:           req.userRole,
      student_id:                 sid,
      test_type,
      exam_config_id:             test_type === 'subject'     ? exam_config_id             : undefined,
      full_length_exam_config_id: test_type === 'full_length' ? full_length_exam_config_id : undefined,
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
      .populate('exam_config_id',             'name subject')
      .populate('full_length_exam_config_id', 'name')
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
    const assignment = await SatAssignment.findOne({
      _id:         req.params.id,
      assigned_by: req.userId,
    })
      .populate('student_id', 'name email')
      .lean();
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

    let sessionData = null;

    if (assignment.test_type === 'subject' && assignment.session_id) {
      sessionData = await SatTestSession.findById(assignment.session_id).lean();
    } else if (assignment.test_type === 'full_length' && assignment.session_id) {
      const flSession = await SatFullLengthSession.findById(assignment.session_id)
        .populate('math_session_id')
        .populate('rw_session_id')
        .lean();
      sessionData = flSession;
    }

    res.json({ success: true, data: { assignment, session: sessionData } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/sat/student/assignments ─────────────────────────────────────────
// Student fetches their own assigned tests
const getStudentAssignments = async (req, res) => {
  try {
    const assignments = await SatAssignment.find({
      student_id: req.userId,
      is_active:  true,
    })
      .populate('exam_config_id',             'name subject module_1')
      .populate('full_length_exam_config_id', 'name')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, count: assignments.length, data: assignments });
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
};
