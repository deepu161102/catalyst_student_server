const express = require('express');
const router  = express.Router();
const {
  startAssignment,
  submitModule,
  submitAssignment,
  getStudentResponse,
  getAssignmentResponses,
} = require('../controllers/assignmentResponseController');

router.post('/start', startAssignment);
router.patch('/:id/module', submitModule);
router.patch('/:id/submit', submitAssignment);
router.get('/student/:studentId/assignment/:assignmentId', getStudentResponse);
router.get('/assignment/:assignmentId', getAssignmentResponses);

module.exports = router;
