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
  getGuestAssignments,
  getBatchAssignments,
  getAssignmentProgress,
} = require('../controllers/assignmentController');

router.use(protect);

// Guest-accessible: published assignments marked isGuestAccessible
router.get('/guest',            getGuestAssignments);

// Paid-student/mentor/ops only
router.get('/batch/:batchId',   getBatchAssignments);

router.route('/')
  .get(getAssignments)
  .post(createAssignment);

router.route('/:id')
  .get(getAssignmentById)
  .put(updateAssignment)
  .delete(deleteAssignment);

router.get('/:id/student',             getAssignmentForStudent);
router.get('/:id/progress',            getAssignmentProgress);
router.patch('/:id/status',            updateStatus);
router.post('/:id/enroll',             enrollBatches);
router.delete('/:id/enroll/:batchId',  unenrollBatch);

module.exports = router;
