const Assignment         = require('../models/Assignment');
const AssignmentResponse = require('../models/AssignmentResponse');
const Batch              = require('../models/Batch');
const Mentor             = require('../models/Mentor');

const MENTOR_SELECT = 'name email specialization';
const BATCH_SELECT  = 'name subject status mentorId studentId';

// ── GET /api/assignments ──────────────────────────────────────────────────────
const getAssignments = async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.mentorId)  filter.mentorId  = req.query.mentorId;
    if (req.query.status)    filter.status    = req.query.status;
    if (req.query.batchId)   filter.enrolledBatches = req.query.batchId;

    const assignments = await Assignment.find(filter)
      .populate('mentorId',        MENTOR_SELECT)
      .populate('enrolledBatches', BATCH_SELECT)
      .select('-sections.modules.questions.correctAnswer -sections.modules.questions.explanation')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, count: assignments.length, data: assignments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/assignments/:id ──────────────────────────────────────────────────
const getAssignmentById = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate('mentorId',        MENTOR_SELECT)
      .populate('enrolledBatches', BATCH_SELECT)
      .lean();

    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    res.json({ success: true, data: assignment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/assignments/:id/student ─────────────────────────────────────────
// Returns assignment without correct answers — for student taking the test.
const getAssignmentForStudent = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .select('-sections.modules.questions.correctAnswer -sections.modules.questions.explanation')
      .lean();

    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    if (assignment.status !== 'published') {
      return res.status(403).json({ success: false, message: 'Assignment is not published yet' });
    }
    res.json({ success: true, data: assignment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── POST /api/assignments ─────────────────────────────────────────────────────
const createAssignment = async (req, res) => {
  try {
    const { mentorId } = req.body;
    if (!mentorId) return res.status(400).json({ success: false, message: 'mentorId is required' });

    const mentor = await Mentor.findById(mentorId);
    if (!mentor) return res.status(404).json({ success: false, message: 'Mentor not found' });

    const assignment = await Assignment.create(req.body);
    await assignment.populate('mentorId', MENTOR_SELECT);

    res.status(201).json({ success: true, data: assignment });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ── PUT /api/assignments/:id ──────────────────────────────────────────────────
const updateAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true,
    })
      .populate('mentorId',        MENTOR_SELECT)
      .populate('enrolledBatches', BATCH_SELECT);

    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    res.json({ success: true, data: assignment });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ── PATCH /api/assignments/:id/status ────────────────────────────────────────
const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['draft', 'published'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status must be draft or published' });
    }

    const assignment = await Assignment.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).select('assignmentId title status');

    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    res.json({ success: true, data: assignment });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ── POST /api/assignments/:id/enroll ─────────────────────────────────────────
// Adds batches to enrolledBatches — validates each batchId belongs to this mentor.
const enrollBatches = async (req, res) => {
  try {
    const { batchIds } = req.body;
    if (!Array.isArray(batchIds) || !batchIds.length) {
      return res.status(400).json({ success: false, message: 'batchIds array is required' });
    }

    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

    const validBatches = await Batch.find({
      _id:      { $in: batchIds },
      mentorId: assignment.mentorId,
    }).select('_id');

    if (validBatches.length !== batchIds.length) {
      return res.status(400).json({ success: false, message: 'One or more batches are invalid or do not belong to this mentor' });
    }

    const updated = await Assignment.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { enrolledBatches: { $each: batchIds } } },
      { new: true }
    )
      .populate('mentorId',        MENTOR_SELECT)
      .populate('enrolledBatches', BATCH_SELECT);

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ── DELETE /api/assignments/:id/enroll/:batchId ──────────────────────────────
const unenrollBatch = async (req, res) => {
  try {
    const { id, batchId } = req.params;

    const assignment = await Assignment.findById(id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

    const updated = await Assignment.findByIdAndUpdate(
      id,
      { $pull: { enrolledBatches: batchId } },
      { new: true }
    )
      .populate('mentorId',        MENTOR_SELECT)
      .populate('enrolledBatches', BATCH_SELECT);

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ── DELETE /api/assignments/:id ───────────────────────────────────────────────
const deleteAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findByIdAndDelete(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    res.json({ success: true, message: 'Assignment deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/assignments/batch/:batchId ───────────────────────────────────────
// Student portal: published assignments for a batch, without correct answers.
const getBatchAssignments = async (req, res) => {
  try {
    const assignments = await Assignment.find({
      enrolledBatches: req.params.batchId,
      status:          'published',
      isActive:        true,
    })
      .populate('mentorId', 'name email')
      .select('-sections.modules.questions.correctAnswer -sections.modules.questions.explanation')
      .sort({ createdAt: -1 })
      .lean();

    const data = assignments.map(({ mentorId, ...rest }) => ({ ...rest, createdBy: mentorId }));
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/assignments/:id/progress ────────────────────────────────────────
// Mentor: full assignment (with answers) + per-student attempt summary.
const getAssignmentProgress = async (req, res) => {
  try {
    const [assignment, responses] = await Promise.all([
      Assignment.findById(req.params.id)
        .populate({
          path:     'enrolledBatches',
          select:   'name subject studentId',
          populate: { path: 'studentId', select: 'name email' },
        })
        .lean(),
      AssignmentResponse.find({ assignmentId: req.params.id }).lean(),
    ]);

    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

    // Build per-module maxScore from assignment structure
    const moduleMaxScore = {};
    for (const s of assignment.sections) {
      for (const m of s.modules) {
        moduleMaxScore[m.mid] = m.questions.reduce((a, q) => a + (q.score || 1), 0);
      }
    }

    // Index responses by studentId
    const responseMap = {};
    for (const r of responses) {
      const sid = r.studentId?.toString();
      if (sid) responseMap[sid] = r;
    }

    const attempts = [];
    for (const batch of (assignment.enrolledBatches || [])) {
      const student = batch.studentId;
      if (!student) continue;
      const sid      = (student._id || student).toString();
      const response = responseMap[sid];

      attempts.push({
        studentId:    student._id,
        studentName:  student.name,
        studentEmail: student.email,
        batchId:      batch._id,
        batchName:    batch.name,
        status:       response
          ? (response.status === 'submitted' ? 'completed' : response.status)
          : 'not_started',
        score:        response?.overallScore ?? null,
        maxScore:     response?.maxScore     ?? null,
        percentage:   response?.percentage   ?? null,
        passed:       response?.passed       ?? null,
        completedAt:  response?.submittedAt  ?? null,
        sectionResults: (response?.sectionResponses || []).map(sr => ({
          sectionId:   sr.sid,
          sectionName: sr.sid === 'rw' ? 'Reading and Writing' : 'Math',
          modules: (sr.moduleResponses || []).map(mr => ({
            moduleNumber:   mr.moduleNumber,
            score:          mr.score,
            maxScore:       moduleMaxScore[mr.mid] ?? mr.totalQuestions,
            correctAnswers: mr.correctAnswers,
            totalQuestions: mr.totalQuestions,
            timeTaken:      null,
            answers:        Object.fromEntries((mr.answers || []).map(a => [a.qid, a.selected])),
          })),
        })),
      });
    }

    res.json({ success: true, data: { ...assignment, attempts } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAssignments,
  getAssignmentById,
  getAssignmentForStudent,
  createAssignment,
  updateAssignment,
  updateStatus,
  enrollBatches,
  unenrollBatch,
  deleteAssignment,
  getBatchAssignments,
  getAssignmentProgress,
};
