"use strict";

const path = require("path");
const fs = require("fs");
const slugify = require("slugify");
const json = require("../../../Traits/ApiResponser"); // Custom response helper
const db = require("../../../Models/index");
const { Op } = require("sequelize");

const Conversation = db.Conversation;
const Message = db.Message;
const User = db.User;

/**
 * Sequential field validation helper
 */
function validateRequiredFieldsSequentially(body, requiredFields) {
  for (const field of requiredFields) {
    const value = body[field];
    if (!value || (typeof value === "string" && value.trim() === "")) {
      throw new Error(`Field "${field}" is required`);
    }
  }
}

const o = {};

/**
 * Create or get an existing conversation between two users
 */
o.createOrGetConversation = async function (req, res, next) {
  try {
    const { user1Id, user2Id } = req.body;

    validateRequiredFieldsSequentially(req.body, ["user1Id", "user2Id"]);

    // Ensure both users exist
    const user1 = await User.findByPk(user1Id);
    const user2 = await User.findByPk(user2Id);

    if (!user1 || !user2)
      return json.errorResponse(res, "Invalid users provided.", 404);

    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      where: {
        [Op.or]: [
          { user1Id: user1Id, user2Id: user2Id },
          { user1Id: user2Id, user2Id: user1Id },
        ],
      },
      include: [
        { model: User, as: "user1", attributes: ["id", "fullname", "email"] },
        { model: User, as: "user2", attributes: ["id", "fullname", "email"] },
      ],
    });

    if (!conversation) {
      conversation = await Conversation.create({ user1Id, user2Id });
    }

    return json.showOne(res, conversation, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

/**
 * Get all conversations for a given user
 */
o.getUserConversations = async function (req, res, next) {
  try {
    const userId = req.decoded.id;

    if (!userId) return json.errorResponse(res, "User ID is required", 400);

    const conversations = await Conversation.findAll({
      where: {
        [Op.or]: [{ user1Id: userId }, { user2Id: userId }],
      },
      include: [
        {
          model: User,
          as: "user1",
          attributes: { exclude: ["password"] },
        },
        {
          model: User,
          as: "user2",
          attributes: { exclude: ["password"] },
        },
        {
          model: Message,
          as: "messages",
          include: [
            {
              model: User,
              as: "sender",
              attributes: ["id", "fullname", "email"],
            },
            {
              model: User,
              as: "receiver",
              attributes: ["id", "fullname", "email"],
            },
          ],
          order: [["createdAt", "ASC"]],
        },
      ],
      order: [["updatedAt", "DESC"]],
    });

    if (!conversations || conversations.length === 0)
      return json.errorResponse(res, "No conversations found.", 404);

    return json.showAll(res, conversations, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

/**
 * Get a single conversation by ID
 */
o.getConversationById = async function (req, res, next) {
  try {
    const { id } = req.params;

    const conversation = await Conversation.findByPk(id, {
      include: [
        { model: User, as: "user1", attributes: ["id", "name", "email"] },
        { model: User, as: "user2", attributes: ["id", "name", "email"] },
        {
          model: Message,
          as: "messages",
          include: [
            { model: User, as: "sender", attributes: ["id", "name"] },
            { model: User, as: "receiver", attributes: ["id", "name"] },
          ],
          order: [["createdAt", "ASC"]],
        },
      ],
    });

    if (!conversation)
      return json.errorResponse(res, "Conversation not found.", 404);

    return json.showOne(res, conversation, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

/**
 * Delete a conversation (and all messages)
 */
o.deleteConversation = async function (req, res, next) {
  try {
    const { id } = req.params;

    const conversation = await Conversation.findByPk(id);
    if (!conversation)
      return json.errorResponse(res, "Conversation not found", 404);

    await conversation.destroy();

    return json.successResponse(res, "Conversation deleted successfully.", 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

module.exports = o;
