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

// Practice routes — accessible to both paid and demo/guest users
router.get('/practice/history',              protect, getPracticeHistory);
router.get('/practice',                      protect, listPracticeConfigs);
router.post('/practice/start',               protect, startPracticeSession);
router.post('/practice/:sessionId/submit',   protect, submitPractice);
router.get('/practice/:sessionId/results',   protect, getPracticeResults);

// Diagnostic / mock test routes — accessible to guests for demo-accessible tests;
// the startSession controller enforces is_demo_accessible for guests.
router.get('/history',                           protect, getHistory);
router.get('/configs',                           protect, listExamConfigs);
router.post('/start',                            protect, startSession);
router.post('/:sessionId/module/1/submit',       protect, submitModule1);
router.get('/:sessionId/module/2',               protect, getModule2);
router.post('/:sessionId/module/2/submit',       protect, submitModule2);
router.get('/:sessionId/results',                protect, getResults);

// Assignments — paid accounts only
router.get('/assignments',                       protect, requireFullAccess, getStudentAssignments);

module.exports = router;
