const express = require('express');
const router  = express.Router();
const protect = require('../../middleware/auth');
const { requireFullAccess } = require('../../middleware/auth');
const {
  startSession,
  submitModule1,
  getModule2,
  submitModule2,
  getResults,
} = require('../../controllers/sat/satTestController');

const { getStudentAssignments } = require('../../controllers/sat/satMentorController');

router.use(protect, requireFullAccess);

router.get('/assignments',                       getStudentAssignments);
router.post('/start',                            startSession);
router.post('/:sessionId/module/1/submit',       submitModule1);
router.get('/:sessionId/module/2',               getModule2);
router.post('/:sessionId/module/2/submit',       submitModule2);
router.get('/:sessionId/results',                getResults);

module.exports = router;
