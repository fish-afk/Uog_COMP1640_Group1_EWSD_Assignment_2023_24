const Mysql = require("../models/_mysql");
const nodemailer = require("nodemailer");
const {
	getCurrentDate,
	hasClosurePassed,
	
} = require("../common/common_utils");
const moment = require("moment");

require("dotenv").config();

//setup nodemailer for sending new idea post and new comment emails
const transport = nodemailer.createTransport({
	host: "smtp.gmail.com",
	port: 587,
	auth: {
		user: process.env.GMAIL_EMAIL,
		pass: process.env.GMAIL_APP_PASSWORD,
	},
});

function formatDate(date) {
	return moment(date).format("YYYY-MM-DD HH:mm:ss");
}

const checkIFBanned = (username) => {
	return new Promise((resolve, reject) => {
		// Replace this with your other database query
		const query = `SELECT * FROM users WHERE username = ? AND account_active = 0`;
		Mysql.connection.query(query, [username], (err, results) => {
			if (err) {
				console.log(err)
				reject("Db error");
			} else {
				
				resolve(results);
			}
		});
	});
};

const gettotalcommentsperdept = (req, res) => {
	const privs = req.decoded["privs"];
	const { department_id } = req.body;
	if (privs != "admin" && privs != "qa_manager" && privs != "qa_coordinator") {
		return res
			.status(401)
			.send({ status: "FAILURE", message: "Insufficient privileges" });
	} else {
		const query = `SELECT
    users.department_id,
    COUNT(comments.comment_id) AS total_comments_posted
FROM
    users
LEFT JOIN comments ON users.username = comments.username
WHERE
    users.department_id = ?
GROUP BY
    users.department_id;
`;
		Mysql.connection.query(query, [department_id], (err, results) => {
			if (err) {
				console.log(err);
				return res.status(500).send({
					status: "FAILURE",
					message: "Unknown error",
				});
			} else {
				return res.send({
					status: "SUCCESS",
					data: results,
				});
			}
		});
	}
};

// Create a comment
const newCommentPost = async (req, res) => {
	const username = req.decoded['username']

	try {
		const [checkIFBannedrecord] = await Promise.all([checkIFBanned(username)]);
		if (checkIFBannedrecord.length > 0) {
			return res.send({
				status: "FAILURE",
				message: "You have been banned from posting new ideas and comments",
			});
		}

		const todaysDate = getCurrentDate();
		const hasClosurePassed_ = hasClosurePassed(
			todaysDate,
			process.env.FINAL_CLOSURE_DATE,
		);

		if (hasClosurePassed_ == true) {
			return res.send({
				status: "FAILURE",
				message:
					"Sorry, The closure date for comments has passed for this academic year, and comments can no longer be posted",
			});
		}

		const {
			comment,
			date_and_time_posted_on = formatDate(Date.now()),
			post_is_anonymous,
			idea_id,
		} = req.body;

		const query =
			"INSERT INTO comments (comment, date_and_time_posted_on, post_is_anonymous, idea_id, username) VALUES (?, ?, ?, ?, ?)";

		Mysql.connection.query(
			query,
			[comment, date_and_time_posted_on, post_is_anonymous, idea_id, username],
			(err, results) => {
				if (err) {
					console.error("Error creating a comment:", err);
					res
						.status(500)
						.send({ status: "FAILURE", message: "Error creating a comment" });
				} else {
					const query1 = `SELECT * FROM ideas WHERE idea_id = ?`;

					Mysql.connection.query(query1, [idea_id], (err, results) => {
						if (err) {
							console.log(err);
							return res.send({
								status: "FAILURE",
								message: "Unknown error",
							});
						} else {
							const record = results[0];
							const username = record?.username;

							const query2 = `SELECT * FROM users WHERE username = ?`;

							Mysql.connection.query(
								query2,
								[username],
								async (err, results) => {
									if (err) {
										console.log(err);
										return res.send({
											status: "FAILURE",
											message: "Unknown error",
										});
									} else {
										const record2 = results[0];
										const email = record2?.email;

										if (email) {
											const info = await transport.sendMail({
												to: email, // list of receivers
												subject: "New comment post on your idea", // Subject line
												text:
													"A new comment was posted on your idea post by the user: " +
													username, // plain text body
											});
											console.log(info);
										}

										return res.status(201).json({
											status: "SUCCESS",
											message: "Comment posted successfully",
										});
									}
								},
							);
						}
					});
				}
			},
		);
	} catch (error) {
		console.log(error);
		return res.send({ status: "FAILURE", message: "Unknown error" });
	}
};



// Read all comments for a specific idea
const getCommentsByIdeaId = (req, res) => {
	const idea_id = req.body["idea_id"];
	const query = "SELECT * FROM comments WHERE idea_id = ?";
	Mysql.connection.query(query, [idea_id], (err, results) => {
		if (err) {
			console.error("Error fetching comments:", err);
			res
				.status(500)
				.send({ status: "FAILURE", message: "Error fetching comments" });
		} else {
			res.status(200).json({ status: "SUCCESS", data: results });
		}
	});
};

// Read a single comment by comment_id
const getCommentById = (req, res) => {
	const comment_id = req.query.comment_id;
	const query = "SELECT * FROM comments WHERE comment_id = ?";
	Mysql.connection.query(query, [comment_id], (err, results) => {
		if (err) {
			console.error("Error fetching comment:", err);
			res
				.status(500)
				.send({ status: "FAILURE", message: "Error fetching comment" });
		} else {
			if (results.length > 0) {
				res.status(200).json({ status: "SUCCESS", data: results[0] });
			} else {
				res
					.status(404)
					.send({ status: "FAILURE", message: "Comment not found" });
			}
		}
	});
};

// Update a comment by comment_id
const updateCommentById = (req, res) => {
	const comment_id = req.body.comment_id;
	const {
		comment,
		date_and_time_posted_on,
		post_is_anonymous,
		idea_id,
		username,
	} = req.body;
	const query =
		"UPDATE comments SET comment = ?, date_and_time_posted_on = ?, post_is_anonymous = ?, idea_id = ?, username = ? WHERE comment_id = ?";
	Mysql.connection.query(
		query,
		[
			comment,
			date_and_time_posted_on,
			post_is_anonymous,
			idea_id,
			username,
			comment_id,
		],
		(err, results) => {
			if (err) {
				console.error("Error updating comment:", err);
				res
					.status(500)
					.send({ status: "FAILURE", message: "Error updating comment" });
			} else {
				res
					.status(200)
					.json({ status: "SUCCESS", message: "Comment updated successfully" });
			}
		},
	);
};

// Delete a comment by comment_id
const deleteCommentById = (req, res) => {
	const comment_id = req.body.comment_id;
	const query = "DELETE FROM comments WHERE comment_id = ?";
	Mysql.connection.query(query, [comment_id], (err, results) => {
		if (err) {
			console.error("Error deleting comment:", err);
			res
				.status(500)
				.send({ status: "FAILURE", message: "Error deleting comment" });
		} else {
			res
				.status(200)
				.json({ status: "SUCCESS", message: "Comment deleted successfully" });
		}
	});
};

module.exports = {
	newCommentPost,
	getCommentsByIdeaId,
	getCommentById,
	updateCommentById,
	deleteCommentById,
	gettotalcommentsperdept
};

