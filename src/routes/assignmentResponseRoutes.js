const express = require('express');
const router  = express.Router();
const protect = require('../middleware/auth');
const {
  getResponses,
  getResponseById,
  startAssignment,
  submitAssignment,
  deleteResponse,
} = require('../controllers/assignmentResponseController');

router.use(protect);

router.route('/')
  .get(getResponses)
  .post(startAssignment);           // student starts test → creates in_progress response

router.route('/:id')
  .get(getResponseById)
  .delete(deleteResponse);

router.post('/:id/submit', submitAssignment); // student submits answers → auto-scored

module.exports = router;
