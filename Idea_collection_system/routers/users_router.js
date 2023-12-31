const userController = require('../controllers/users')
const authMiddleware = require('../middleware/auth_middleware')
const express = require("express");

const router = express.Router()

router.post('/signup', userController.signup)
router.post('/login', userController.login)
router.post('/refresh', userController.refresh)
router.post('/getuserdata', authMiddleware.verifyJWT, userController.getUserData)
router.patch('/changepassword', authMiddleware.verifyJWT, userController.changePassword)
router.patch('/updatedetails', authMiddleware.verifyJWT, userController.updateAccountDetails)
router.patch('/enableaccount', authMiddleware.verifyJWT, userController.enableAccount)
router.patch('/disableaccount', authMiddleware.verifyJWT, userController.disableAccount);
router.patch('/hideposts', authMiddleware.verifyJWT, userController.hidePostsAndComments)
router.patch('/unhideposts', authMiddleware.verifyJWT, userController.UnhidePostsAndComments);
router.post('/confirmjwt', authMiddleware.confirmJWT)
router.post('/getallusers', authMiddleware.verifyJWT, userController.getAllUsers)
router.post('/getallusersbydept', authMiddleware.verifyJWT, userController.getallusersbydept)
router.get('/exportcsv', userController.ExportCSV)

module.exports = router;