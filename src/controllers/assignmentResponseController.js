const AssignmentResponse = require('../models/AssignmentResponse');
const Assignment         = require('../models/Assignment');

// ── GET /api/assignment-responses ────────────────────────────────────────────
const getResponses = async (req, res) => {
  try {
    const filter = {};
    if (req.query.assignmentId) filter.assignmentId = req.query.assignmentId;
    if (req.query.studentId)    filter.studentId    = req.query.studentId;
    if (req.query.batchId)      filter.batchId      = req.query.batchId;
    if (req.query.status)       filter.status       = req.query.status;

    const responses = await AssignmentResponse.find(filter)
      .populate('assignmentId', 'title dueDate passingScore')
      .populate('studentId',    'name email')
      .populate('batchId',      'name subject')
      .select('-sectionResponses.moduleResponses.answers')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, count: responses.length, data: responses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/assignment-responses/:id ────────────────────────────────────────
const getResponseById = async (req, res) => {
  try {
    const response = await AssignmentResponse.findById(req.params.id)
      .populate('assignmentId', 'title dueDate passingScore sections')
      .populate('studentId',    'name email')
      .populate('batchId',      'name subject')
      .lean();

    if (!response) return res.status(404).json({ success: false, message: 'Response not found' });
    res.json({ success: true, data: response });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── POST /api/assignment-responses ───────────────────────────────────────────
// Student starts an assignment — creates an in_progress response.
const startAssignment = async (req, res) => {
  try {
    const { assignmentId, studentId, batchId } = req.body;
    if (!assignmentId) return res.status(400).json({ success: false, message: 'assignmentId is required' });
    if (!studentId)    return res.status(400).json({ success: false, message: 'studentId is required' });
    if (!batchId)      return res.status(400).json({ success: false, message: 'batchId is required' });

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    if (assignment.status !== 'published') {
      return res.status(403).json({ success: false, message: 'Assignment is not published' });
    }

    const existing = await AssignmentResponse.findOne({ assignmentId, studentId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'You have already started this assignment', data: existing });
    }

    const response = await AssignmentResponse.create({ assignmentId, studentId, batchId });
    res.status(201).json({ success: true, data: response });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ── POST /api/assignment-responses/:id/submit ─────────────────────────────────
// Student submits answers — server scores per module, per section, and overall.
const submitAssignment = async (req, res) => {
  try {
    const response = await AssignmentResponse.findById(req.params.id);
    if (!response) return res.status(404).json({ success: false, message: 'Response not found' });
    if (response.status === 'submitted') {
      return res.status(400).json({ success: false, message: 'Assignment already submitted' });
    }

    const assignment = await Assignment.findById(response.assignmentId).lean();
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

    const { sectionResponses } = req.body;
    if (!Array.isArray(sectionResponses)) {
      return res.status(400).json({ success: false, message: 'sectionResponses array is required' });
    }

    // Build a flat lookup: qid → { correctAnswer, score }
    const questionMap = {};
    for (const section of assignment.sections) {
      for (const mod of section.modules) {
        for (const q of mod.questions) {
          questionMap[q.qid] = { correctAnswer: q.correctAnswer, score: q.score };
        }
      }
    }

    let overallScore = 0;
    let maxScore     = 0;

    const scoredSections = sectionResponses.map(sr => {
      let sectionScore = 0;

      const scoredModules = (sr.moduleResponses || []).map(mr => {
        let moduleScore     = 0;
        let correctAnswers  = 0;
        const answers       = mr.answers || [];

        for (const ans of answers) {
          const meta = questionMap[ans.qid];
          if (!meta) continue;
          maxScore += meta.score;
          if (ans.selected === meta.correctAnswer) {
            moduleScore    += meta.score;
            correctAnswers += 1;
          }
        }

        overallScore += moduleScore;
        sectionScore += moduleScore;

        return {
          mid:            mr.mid,
          moduleNumber:   mr.moduleNumber,
          answers,
          score:          moduleScore,
          totalQuestions: answers.length,
          correctAnswers,
        };
      });

      return { sid: sr.sid, moduleResponses: scoredModules, sectionScore };
    });

    const percentage = maxScore > 0 ? Math.round((overallScore / maxScore) * 100) : 0;
    const passed     = percentage >= assignment.passingScore;

    response.sectionResponses = scoredSections;
    response.overallScore     = overallScore;
    response.maxScore         = maxScore;
    response.percentage       = percentage;
    response.passed           = passed;
    response.status           = 'submitted';
    response.submittedAt      = new Date();
    await response.save();

    await response.populate([
      { path: 'assignmentId', select: 'title passingScore' },
      { path: 'studentId',    select: 'name email' },
    ]);

    res.json({ success: true, data: response });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── DELETE /api/assignment-responses/:id ─────────────────────────────────────
const deleteResponse = async (req, res) => {
  try {
    const response = await AssignmentResponse.findByIdAndDelete(req.params.id);
    if (!response) return res.status(404).json({ success: false, message: 'Response not found' });
    res.json({ success: true, message: 'Response deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getResponses,
  getResponseById,
  startAssignment,
  submitAssignment,
  deleteResponse,
};
