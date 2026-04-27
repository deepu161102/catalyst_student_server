const express = require('express');
const router  = express.Router();
const {
  getResponses,
  getResponseById,
  createResponse,
  updateResponse,
  deleteResponse,
} = require('../controllers/assignmentResponseController');

router.route('/').get(getResponses).post(createResponse);
router.route('/:id').get(getResponseById).put(updateResponse).delete(deleteResponse);

module.exports = router;
