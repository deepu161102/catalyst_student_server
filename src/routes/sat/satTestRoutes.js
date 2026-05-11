const express = require('express');
const router  = express.Router();
const protect = require('../../middleware/auth');
const { requireFullAccess } = require('../../middleware/auth');
const {
  listExamConfigs,
  startSession,
  submitModule1,
  getModule2,
  submitModule2,
  getResults,
  listPracticeConfigs,
  startPracticeSession,
  submitPractice,
  getPracticeResults,
  getPracticeHistory,
  getHistory,
} = require('../../controllers/sat/satTestController');

const { getStudentAssignments } = require('../../controllers/sat/satMentorController');

// Practice routes — accessible to both paid and demo/guest users (no requireFullAccess)
router.get('/practice/history',              protect, getPracticeHistory);
router.get('/practice',                      protect, listPracticeConfigs);
router.post('/practice/start',               protect, startPracticeSession);
router.post('/practice/:sessionId/submit',   protect, submitPractice);
router.get('/practice/:sessionId/results',   protect, getPracticeResults);

// All routes below require a fully paid (non-guest) account
router.use(protect, requireFullAccess);

router.get('/history',                           getHistory);
router.get('/configs',                           listExamConfigs);
router.get('/assignments',                       getStudentAssignments);
router.post('/start',                            startSession);
router.post('/:sessionId/module/1/submit',       submitModule1);
router.get('/:sessionId/module/2',               getModule2);
router.post('/:sessionId/module/2/submit',       submitModule2);
router.get('/:sessionId/results',                getResults);

module.exports = router;
