const Assignment         = require('../models/Assignment');
const AssignmentResponse = require('../models/AssignmentResponse');

// POST /api/assignment-responses/start
// Student starts an assignment — idempotent (returns existing if already started)
const startAssignment = async (req, res) => {
  try {
    const { assignmentId, studentId, batchId } = req.body;

    const assignment = await Assignment.findById(assignmentId).lean();
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

    const existing = await AssignmentResponse.findOne({ assignmentId, studentId });
    if (existing) return res.json({ success: true, data: existing });

    // Build empty section/module shell mirroring the assignment structure
    const sections = assignment.sections.map((section) => ({
      name: section.name,
      modules: section.modules.map((mod) => ({
        moduleNumber:     mod.moduleNumber,
        startedAt:        null,
        submittedAt:      null,
        timeTakenSeconds: null,
        answers:          mod.questions.map((q) => ({ questionNumber: q.number, selectedAnswer: null })),
        score:            0,
      })),
    }));

    const response = await AssignmentResponse.create({
      assignmentId,
      studentId,
      batchId,
      status: 'in_progress',
      startedAt: new Date(),
      sections,
    });

    res.status(201).json({ success: true, data: response });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// PATCH /api/assignment-responses/:id/module
// Student submits answers for one module
// Body: { sectionName, moduleNumber, answers: [{questionNumber, selectedAnswer}], timeTakenSeconds }
const submitModule = async (req, res) => {
  try {
    const { sectionName, moduleNumber, answers, timeTakenSeconds } = req.body;

    const response = await AssignmentResponse.findById(req.params.id);
    if (!response) return res.status(404).json({ success: false, message: 'Response not found' });
    if (response.status === 'completed')
      return res.status(400).json({ success: false, message: 'Assignment already submitted' });

    const assignment = await Assignment.findById(response.assignmentId).lean();
    const section    = assignment.sections.find((s) => s.name === sectionName);
    const mod        = section?.modules.find((m) => m.moduleNumber === moduleNumber);
    if (!mod) return res.status(404).json({ success: false, message: 'Module not found in assignment' });

    // Calculate score by comparing answers against correctAnswer
    const score = answers.reduce((count, ans) => {
      const question = mod.questions.find((q) => q.number === ans.questionNumber);
      return question?.correctAnswer === ans.selectedAnswer ? count + 1 : count;
    }, 0);

    const sectionIndex = response.sections.findIndex((s) => s.name === sectionName);
    const moduleIndex  = response.sections[sectionIndex].modules.findIndex(
      (m) => m.moduleNumber === moduleNumber
    );

    response.sections[sectionIndex].modules[moduleIndex].answers          = answers;
    response.sections[sectionIndex].modules[moduleIndex].score            = score;
    response.sections[sectionIndex].modules[moduleIndex].submittedAt      = new Date();
    response.sections[sectionIndex].modules[moduleIndex].timeTakenSeconds = timeTakenSeconds;

    await response.save();
    res.json({ success: true, data: response });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// PATCH /api/assignment-responses/:id/submit
// Student final submission — calculates totalScore and marks as completed
const submitAssignment = async (req, res) => {
  try {
    const response = await AssignmentResponse.findById(req.params.id);
    if (!response) return res.status(404).json({ success: false, message: 'Response not found' });
    if (response.status === 'completed')
      return res.status(400).json({ success: false, message: 'Assignment already submitted' });

    const rwSection   = response.sections.find((s) => s.name === 'Reading & Writing');
    const mathSection = response.sections.find((s) => s.name === 'Math');

    const rwScore   = rwSection?.modules.reduce((sum, m) => sum + m.score, 0) ?? 0;
    const mathScore = mathSection?.modules.reduce((sum, m) => sum + m.score, 0) ?? 0;

    response.status              = 'completed';
    response.submittedAt         = new Date();
    response.totalScore          = {
      readingWriting: rwScore,
      math:           mathScore,
      overall:        rwScore + mathScore,
    };

    await response.save();
    res.json({ success: true, data: response });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// GET /api/assignment-responses/student/:studentId/assignment/:assignmentId
const getStudentResponse = async (req, res) => {
  try {
    const { studentId, assignmentId } = req.params;
    const response = await AssignmentResponse.findOne({ studentId, assignmentId })
      .populate('assignmentId', 'title type dueDate')
      .lean();
    if (!response) return res.status(404).json({ success: false, message: 'Response not found' });
    res.json({ success: true, data: response });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/assignment-responses/assignment/:assignmentId
// Mentor views all student responses for an assignment
const getAssignmentResponses = async (req, res) => {
  try {
    const responses = await AssignmentResponse.find({ assignmentId: req.params.assignmentId })
      .populate('studentId', 'name email')
      .lean();
    res.json({ success: true, count: responses.length, data: responses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  startAssignment,
  submitModule,
  submitAssignment,
  getStudentResponse,
  getAssignmentResponses,
};
