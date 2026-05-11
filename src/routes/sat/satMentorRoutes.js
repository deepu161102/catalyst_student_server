const express = require('express');
const router  = express.Router();
const protect = require('../../middleware/auth');
const { requireMentor } = require('../../middleware/auth');
const {
  listAvailableTests,
  assignTest,
  assignBatch,
  getMyAssignments,
  getAssignmentResults,
  getStudentAdaptiveSessions,
  getStudentPracticeSessions,
  getAdaptiveSessionResults,
  getPracticeSessionResults,
  getFullLengthSessionResults,
} = require('../../controllers/sat/satMentorController');

router.use(protect, requireMentor);

router.get('/exam-configs',                          listAvailableTests);
router.post('/assign',                               assignTest);
router.post('/assign/batch',                         assignBatch);
router.get('/assignments',                           getMyAssignments);
router.get('/assignments/:id/results',               getAssignmentResults);
router.get('/student/:studentId/sessions',           getStudentAdaptiveSessions);
router.get('/student/:studentId/practice-sessions',  getStudentPracticeSessions);
router.get('/sessions/:sessionId/results',                 getAdaptiveSessionResults);
router.get('/practice-sessions/:sessionId/results',        getPracticeSessionResults);
router.get('/full-length-sessions/:sessionId/results',     getFullLengthSessionResults);

module.exports = router;
