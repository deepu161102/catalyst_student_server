const express = require('express');
const router  = express.Router();
const protect = require('../middleware/auth');
const {
  getAllBatches,
  getBatchById,
  createBatch,
  updateBatch,
  deleteBatch,
  addStudentToBatch,
  removeStudentFromBatch,
  getAllMentors,
} = require('../controllers/batchController');

router.use(protect);

router.get('/mentors', getAllMentors);          // ops dropdown — list all mentors

router.route('/')
  .get(getAllBatches)
  .post(createBatch);

router.route('/:id')
  .get(getBatchById)
  .put(updateBatch)
  .delete(deleteBatch);

router.post('/:id/students',                    addStudentToBatch);
router.delete('/:id/students/:studentId',       removeStudentFromBatch);

module.exports = router;
