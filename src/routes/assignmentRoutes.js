const express = require('express');
const router  = express.Router();
const protect = require('../middleware/auth');
const {
  getAllAssignments,
  getAssignmentsByBatch,
  getAssignmentById,
  createAssignment,
  updateAssignment,
  setAssignmentStatus,
  enrollBatches,
  deleteAssignment,
} = require('../controllers/assignmentController');

router.get('/batch/:batchId', getAssignmentsByBatch);

router.route('/')
  .get(getAllAssignments)
  .post(protect, createAssignment);

router.patch('/:id/status',  protect, setAssignmentStatus);
router.post('/:id/enroll',   protect, enrollBatches);

router.route('/:id')
  .get(getAssignmentById)
  .put(protect, updateAssignment)
  .delete(protect, deleteAssignment);

module.exports = router;
