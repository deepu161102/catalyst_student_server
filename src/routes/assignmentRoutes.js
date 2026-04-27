const express = require('express');
const router  = express.Router();
const {
  getAssignments,
  getAssignmentById,
  createAssignment,
  updateAssignment,
  deleteAssignment,
} = require('../controllers/assignmentController');

router.route('/').get(getAssignments).post(createAssignment);
router.route('/:id').get(getAssignmentById).put(updateAssignment).delete(deleteAssignment);

module.exports = router;
