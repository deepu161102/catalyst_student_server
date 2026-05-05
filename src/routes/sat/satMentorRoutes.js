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
} = require('../../controllers/sat/satMentorController');

router.use(protect, requireMentor);

router.get('/exam-configs',              listAvailableTests);
router.post('/assign',                   assignTest);
router.post('/assign/batch',             assignBatch);
router.get('/assignments',               getMyAssignments);
router.get('/assignments/:id/results',   getAssignmentResults);

module.exports = router;
