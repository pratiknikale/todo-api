const express = require("express");
const auth = require("../middleware/auth");
const router = express.Router();
const Chat = require("../models/chatModel");
let Users = require("../models/users");

router.post("/", auth, async (req, res) => {
  const {userId} = req.body;
  if (!userId) {
    console.log("userid not cought with request data");
    return res.status(400);
  }

  var isChat = await Chat.find({
    isGroupChat: false,
    $and: [{users: {$elemMatch: {$eq: req.userID}}}, {users: {$elemMatch: {$eq: userId}}}],
  })
    .populate("users", "-password")
    .populate("latestMessage");

  isChat = await Users.populate(isChat, {
    path: "latestmessage.sender",
    select: "firstName lastName email",
  });

  if (isChat.length > 0) {
    res.status(200).send(isChat[0]);
  } else {
    var chatData = {
      chatName: "sender",
      isGroupChat: false,
      users: [req.userID, userId],
    };
    try {
      const createdChat = await Chat.create(chatData);

      const FullChat = await Chat.findOne({_id: createdChat.id}).populate("users", "-password");
      res.status(200).send(FullChat);
    } catch (error) {
      res.status(400);
      throw new Error(error.message);
    }
  }
});
router.get("/", auth, async (req, res) => {
  try {
    Chat.find({users: {$elemMatch: {$eq: req.userID}}})
      .populate("users", "-password")
      .populate("groupAdmin", "-password")
      .populate("latestMessage")
      .sort({updatedAt: -1})
      .then(async (results) => {
        results = await Users.populate(results, {
          path: "latestMessage.sender",
          select: "firstName lastName email",
        });
        res.status(200).send(results);
      });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});
router.post("/group", auth, async (req, res) => {
  if (!req.body.users || !req.body.name) return res.status(400).send({message: "please fill all fields"});
  var users = JSON.parse(req.body.users);

  if (users.length < 2) return res.status(400).send({message: "must be more than 2 users in group"});

  users.push(req.userID);

  try {
    const groupChat = await Chat.create({
      chatName: req.body.name,
      users: users,
      isGroupChat: true,
      groupAdmin: req.userID,
    });

    const FullGroupChat = await Chat.findOne({_id: groupChat._id})
      .populate("users", "-password")
      .populate("groupAdmin", "-password");
    res.status(200).send(FullGroupChat);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});
router.put("/rename", auth, async (req, res) => {
  const {chatId, chatName} = req.body;

  const updatedChat = await Chat.findByIdAndUpdate(
    chatId,
    {
      chatName,
    },
    {
      new: true,
    }
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password");

  if (!updatedChat) {
    res.status(400);
    throw new Error("chat not found");
  } else {
    res.json(updatedChat);
  }
});
router.put("/groupadd", auth, async (req, res) => {
  const {chatId, userId} = req.body;

  const added = await Chat.findByIdAndUpdate(
    chatId,
    {
      $push: {users: userId},
    },
    {new: true}
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password");

  if (!added) {
    res.status(400);
    throw new Error("chat not found");
  } else {
    res.json(added);
  }
});
router.put("/groupremove", auth, async (req, res) => {
  const {chatId, userId} = req.body;

  const removed = await Chat.findByIdAndUpdate(
    chatId,
    {
      $pull: {users: userId},
    },
    {new: true}
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password");

  if (!removed) {
    res.status(400);
    throw new Error("chat not found");
  } else {
    res.json(removed);
  }
});

module.exports = router;
