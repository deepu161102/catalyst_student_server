const express = require('express');
const router  = express.Router();
const protect = require('../middleware/auth');
const {
  getAllBatches,
  getBatchById,
  createBatch,
  updateBatch,
  deleteBatch,
  getBatchesByStudent,
  getAllMentors,
  getAllStudentsForOps,
} = require('../controllers/batchController');

router.use(protect);

router.get('/mentors',              getAllMentors);        // ops dropdown — list all mentors
router.get('/students',             getAllStudentsForOps); // ops dropdown — list all students
router.get('/by-student/:studentId', getBatchesByStudent); // student portal — all batches + mentors

router.route('/')
  .get(getAllBatches)
  .post(createBatch);

router.route('/:id')
  .get(getBatchById)
  .put(updateBatch)
  .delete(deleteBatch);

module.exports = router;
