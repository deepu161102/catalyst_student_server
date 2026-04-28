const express = require('express');
const router  = express.Router();
const protect = require('../middleware/auth');
const {
  getAssignments,
  getAssignmentById,
  getAssignmentForStudent,
  createAssignment,
  updateAssignment,
  updateStatus,
  enrollBatches,
  unenrollBatch,
  deleteAssignment,
  getBatchAssignments,
  getAssignmentProgress,
} = require('../controllers/assignmentController');

router.use(protect);

// specific routes before parameterised /:id
router.get('/batch/:batchId', getBatchAssignments);   // student portal — published by batch

router.route('/')
  .get(getAssignments)
  .post(createAssignment);

router.route('/:id')
  .get(getAssignmentById)
  .put(updateAssignment)
  .delete(deleteAssignment);

router.get('/:id/student',   getAssignmentForStudent); // student view — no answers/explanations
router.get('/:id/progress',  getAssignmentProgress);   // mentor progress view
router.patch('/:id/status',  updateStatus);            // toggle draft | published
router.post('/:id/enroll',              enrollBatches);  // add batches after creation
router.delete('/:id/enroll/:batchId',   unenrollBatch);  // remove a single batch

module.exports = router;
