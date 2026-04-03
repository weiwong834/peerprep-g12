import { useEffect, useMemo, useState } from "react";
import {
  archiveQuestion,
  createQuestion,
  createTopic,
  deleteQuestion,
  editQuestion,
  getQuestions,
  getTopics,
  restoreQuestion,
  type Question,
  type Topic,
} from "../services/questionService";
import { getAllUsers, promoteUser } from "../services/userService";

type AdminUser = {
  id: string;
  username: string;
  isAdmin: boolean;
};

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<"questions" | "users">(
    "questions",
  );

  const [topics, setTopics] = useState<Topic[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);

  const [selectedTopic, setSelectedTopic] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  const [loadingTopics, setLoadingTopics] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState("");
  const [createError, setCreateError] = useState("");
  const [questionSearch, setQuestionSearch] = useState("");

  const [showAddTopicInput, setShowAddTopicInput] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [topicMessage, setTopicMessage] = useState("");
  const [topicError, setTopicError] = useState("");

  const [openMenuQuestionId, setOpenMenuQuestionId] = useState<string | null>(
    null,
  );
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(
    null,
  );

  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(
    null,
  );
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDifficulty, setEditDifficulty] = useState("");
  const [editTopics, setEditTopics] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [editMessage, setEditMessage] = useState("");
  const [editError, setEditError] = useState("");

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userError, setUserError] = useState("");
  const [userMessage, setUserMessage] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [promotingUserId, setPromotingUserId] = useState<string | null>(null);

  async function loadTopics() {
    try {
      setLoadingTopics(true);
      const data = await getTopics();
      setTopics(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load topics.";
      setError(message);
    } finally {
      setLoadingTopics(false);
    }
  }

  async function loadQuestions() {
    try {
      setLoadingQuestions(true);
      setError("");

      const data = await getQuestions({
        topic: selectedTopic || undefined,
        difficulty: selectedDifficulty || undefined,
        status: selectedStatus || undefined,
      });

      setQuestions(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load questions.";
      setError(message);
    } finally {
      setLoadingQuestions(false);
    }
  }

  async function loadUsers() {
    try {
      setLoadingUsers(true);
      setUserError("");
      const data = await getAllUsers();
      console.log("All users from backend:", data);
      setUsers(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load users.";
      setUserError(message);
    } finally {
      setLoadingUsers(false);
    }
  }

  useEffect(() => {
    loadTopics();
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [selectedTopic, selectedDifficulty, selectedStatus]);

  useEffect(() => {
    if (activeTab === "users") {
      loadUsers();
    }
  }, [activeTab]);

  function toggleTopic(topicName: string) {
    setSelectedTopics((prev) =>
      prev.includes(topicName)
        ? prev.filter((t) => t !== topicName)
        : [...prev, topicName],
    );
  }

  function toggleEditTopic(topicName: string) {
    setEditTopics((prev) =>
      prev.includes(topicName)
        ? prev.filter((t) => t !== topicName)
        : [...prev, topicName],
    );
  }

  function resetCreateForm() {
    setTitle("");
    setDescription("");
    setDifficulty("");
    setSelectedTopics([]);
  }

  async function handleCreateQuestion(e: React.FormEvent) {
    e.preventDefault();
    setCreateMessage("");
    setCreateError("");

    if (
      !title.trim() ||
      !description.trim() ||
      !difficulty ||
      selectedTopics.length === 0
    ) {
      setCreateError(
        "Please fill in title, description, difficulty, and at least one topic.",
      );
      return;
    }

    try {
      setCreating(true);

      await createQuestion({
        title: title.trim(),
        description: description.trim(),
        difficulty,
        topics: selectedTopics,
      });

      setCreateMessage("Question created successfully.");
      resetCreateForm();
      await loadQuestions();
      await loadTopics();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create question.";
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  }

  async function handleCreateTopic() {
    setTopicMessage("");
    setTopicError("");

    if (!newTopicName.trim()) {
      setTopicError("Please enter a topic name.");
      return;
    }

    try {
      setCreatingTopic(true);

      const created = await createTopic(newTopicName.trim());
      setTopicMessage(`Topic "${created.name}" created successfully.`);
      setSelectedTopics((prev) =>
        prev.includes(created.name) ? prev : [...prev, created.name],
      );
      setNewTopicName("");
      setShowAddTopicInput(false);
      await loadTopics();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create topic.";
      setTopicError(message);
    } finally {
      setCreatingTopic(false);
    }
  }

  function startEditing(question: Question) {
    setEditingQuestionId(question.id);
    setEditTitle(question.title);
    setEditDescription(getQuestionPreview(question));
    setEditDifficulty(question.difficulty);
    setEditTopics(question.question_topics?.map((t) => t.topic) || []);
    setEditMessage("");
    setEditError("");
    setOpenMenuQuestionId(null);
  }

  function cancelEditing() {
    setEditingQuestionId(null);
    setEditTitle("");
    setEditDescription("");
    setEditDifficulty("");
    setEditTopics([]);
    setEditMessage("");
    setEditError("");
  }

  function getQuestionPreview(question: Question) {
    const textContent = (question.blocks ?? [])
      .filter((block) => block.block_type === "text")
      .map((block) => block.content)
      .join("\n\n");

    return textContent;
  }

  function getQuestionTextPreview(question: Question) {
    return (question.blocks ?? [])
      .filter((block) => block.block_type === "text")
      .map((block) => block.content)
      .join("\n\n");
  }

  async function handleEditQuestion(
    e: React.FormEvent,
    questionNumber: string | number,
  ) {
    e.preventDefault();
    setEditMessage("");
    setEditError("");

    if (
      !editTitle.trim() ||
      !editDescription.trim() ||
      !editDifficulty ||
      editTopics.length === 0
    ) {
      setEditError(
        "Please fill in title, description, difficulty, and at least one topic.",
      );
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to edit this question? The current version will be superseded.",
    );

    if (!confirmed) return;

    try {
      setEditing(true);

      await editQuestion(questionNumber, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        difficulty: editDifficulty,
        topics: editTopics,
      });

      setEditMessage("Question updated successfully.");
      setEditingQuestionId(null);
      await loadQuestions();
      await loadTopics();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update question.";
      setEditError(message);
    } finally {
      setEditing(false);
    }
  }

  async function handleArchiveQuestion(questionNumber: string | number) {
    const confirmed = window.confirm(
      "Are you sure you want to archive this question?",
    );

    if (!confirmed) return;

    try {
      await archiveQuestion(questionNumber);
      await loadQuestions();
      await loadTopics();
      setOpenMenuQuestionId(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to archive question.";
      setError(message);
    }
  }

  async function handleRestoreQuestion(questionNumber: string | number) {
    const confirmed = window.confirm(
      "Are you sure you want to restore this question?",
    );

    if (!confirmed) return;

    try {
      await restoreQuestion(questionNumber);
      await loadQuestions();
      await loadTopics();
      setOpenMenuQuestionId(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to restore question.";
      setError(message);
    }
  }

  async function handleDeleteQuestion(questionNumber: string | number) {
    const confirmed = window.confirm(
      "This will permanently delete the archived question and cannot be undone. Continue?",
    );

    if (!confirmed) return;

    try {
      await deleteQuestion(questionNumber);
      await loadQuestions();
      await loadTopics();
      setOpenMenuQuestionId(null);
      setExpandedQuestionId(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete question.";
      setError(message);
    }
  }

  async function handlePromoteUser(user: AdminUser) {
    const confirmed = window.confirm(
      `Are you sure you want to promote "${user.username}" to admin?`,
    );

    if (!confirmed) return;

    try {
      setPromotingUserId(user.id);
      setUserError("");
      setUserMessage("");

      await promoteUser(user.id);
      setUserMessage(`${user.username} has been promoted to admin.`);
      await loadUsers();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to promote user.";
      setUserError(message);
    } finally {
      setPromotingUserId(null);
    }
  }

  const filteredQuestions = useMemo(() => {
    const keyword = questionSearch.trim();
    if (!keyword) return questions;

    const exactNumberMatch = keyword.match(/^#(\d+)$/);

    if (exactNumberMatch) {
      const targetNumber = exactNumberMatch[1];
      return questions.filter(
        (question) => String(question.question_number) === targetNumber,
      );
    }

    const loweredKeyword = keyword.toLowerCase();

    return questions.filter((question) => {
      const preview = getQuestionTextPreview(question).toLowerCase();
      const topicNames = (question.question_topics ?? [])
        .map((topicObj) => topicObj.topic.toLowerCase())
        .join(" ");

      return (
        question.title.toLowerCase().includes(loweredKeyword) ||
        String(question.question_number).includes(loweredKeyword) ||
        question.difficulty.toLowerCase().includes(loweredKeyword) ||
        question.availability_status.toLowerCase().includes(loweredKeyword) ||
        preview.includes(loweredKeyword) ||
        topicNames.includes(loweredKeyword)
      );
    });
  }, [questions, questionSearch]);

  const filteredUsers = useMemo(() => {
    const keyword = userSearch.trim().toLowerCase();
    if (!keyword) return users;

    return users.filter((user) =>
      user.username.toLowerCase().includes(keyword),
    );
  }, [users, userSearch]);

  return (
    <div className="mx-auto max-w-6xl rounded-2xl bg-white p-8 shadow-md">
      <h1 className="text-2xl font-bold text-slate-800">Admin</h1>
      <p className="mt-2 text-sm text-slate-500">
        Manage the PeerPrep question bank and user roles.
      </p>

      <div className="mt-6 flex gap-2 rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setActiveTab("questions")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            activeTab === "questions"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          Question Bank
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            activeTab === "users"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          User Management
        </button>
      </div>

      {activeTab === "questions" && (
        <>
          <div className="mt-8 rounded-xl border border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-800">
              Create Question
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Add a new question to the repository.
            </p>

            <form onSubmit={handleCreateQuestion} className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setCreateError("");
                    setCreateMessage("");
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="Enter question title"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setCreateError("");
                    setCreateMessage("");
                  }}
                  rows={6}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="Enter question description"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Difficulty
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => {
                    setDifficulty(e.target.value);
                    setCreateError("");
                    setCreateMessage("");
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">Select difficulty</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="block text-sm font-medium text-slate-700">
                    Topics
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddTopicInput((prev) => !prev);
                      setTopicError("");
                      setTopicMessage("");
                    }}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                  >
                    + Add Topic
                  </button>
                </div>

                {showAddTopicInput && (
                  <div className="mb-4 rounded-lg border border-slate-200 p-3">
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      New Topic Name
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newTopicName}
                        onChange={(e) => {
                          setNewTopicName(e.target.value);
                          setTopicError("");
                          setTopicMessage("");
                        }}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                        placeholder="Enter new topic name"
                      />
                      <button
                        type="button"
                        onClick={handleCreateTopic}
                        disabled={creatingTopic}
                        className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {creatingTopic ? "Adding..." : "Add"}
                      </button>
                    </div>

                    {topicMessage && (
                      <p className="mt-2 text-sm text-green-600">
                        {topicMessage}
                      </p>
                    )}
                    {topicError && (
                      <p className="mt-2 text-sm text-red-500">{topicError}</p>
                    )}
                  </div>
                )}

                {loadingTopics ? (
                  <p className="text-sm text-slate-500">Loading topics...</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {topics.map((topic) => {
                      const selected = selectedTopics.includes(topic.name);
                      return (
                        <button
                          key={topic.name}
                          type="button"
                          onClick={() => {
                            toggleTopic(topic.name);
                            setCreateError("");
                            setCreateMessage("");
                          }}
                          className={`rounded-full px-3 py-1 text-sm transition ${
                            selected
                              ? "bg-blue-600 text-white"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {topic.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {createMessage && (
                <p className="text-sm text-green-600">{createMessage}</p>
              )}
              {createError && (
                <p className="text-sm text-red-500">{createError}</p>
              )}

              <button
                type="submit"
                disabled={creating}
                className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {creating ? "Creating..." : "Create Question"}
              </button>
            </form>
          </div>

          <div className="mt-8 rounded-xl border border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-800">
              Question Bank Management
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Filter questions by topic, difficulty, and status.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Topic
                </label>
                <select
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  disabled={loadingTopics}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">All topics</option>
                  {topics.map((topic) => (
                    <option key={topic.name} value={topic.name}>
                      {topic.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Difficulty
                </label>
                <select
                  value={selectedDifficulty}
                  onChange={(e) => setSelectedDifficulty(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">All difficulties</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Status
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">All statuses</option>
                  <option value="available">Available</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Search Questions
              </label>
              <input
                type="text"
                value={questionSearch}
                onChange={(e) => setQuestionSearch(e.target.value)}
                placeholder="Search by title, topic, content, or #question-number"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

            <div className="mt-6">
              {loadingQuestions ? (
                <p className="text-sm text-slate-500">Loading questions...</p>
              ) : filteredQuestions.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No questions found for the selected filters.
                </p>
              ) : (
                <div className="space-y-4">
                  {filteredQuestions.map((question) => {
                    const isExpanded = expandedQuestionId === question.id;

                    return (
                      <div
                        key={question.id}
                        onClick={() =>
                          setExpandedQuestionId((prev) =>
                            prev === question.id ? null : question.id,
                          )
                        }
                        className="cursor-pointer rounded-xl border border-slate-200 p-5 transition hover:shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm text-slate-500">
                              Question #{question.question_number}
                            </p>
                            <h3 className="mt-1 text-lg font-semibold text-slate-800">
                              {question.title}
                            </h3>
                          </div>

                          <div className="flex items-start gap-2">
                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                                {question.difficulty}
                              </span>
                              <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700">
                                {question.availability_status}
                              </span>
                            </div>

                            <div
                              className="relative"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenMenuQuestionId((prev) =>
                                    prev === question.id ? null : question.id,
                                  )
                                }
                                className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700 hover:bg-slate-100"
                              >
                                ⋮
                              </button>

                              {openMenuQuestionId === question.id && (
                                <div className="absolute right-0 z-10 mt-2 w-48 rounded-lg border border-slate-200 bg-white shadow-lg">
                                  {question.availability_status ===
                                    "available" && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => startEditing(question)}
                                        className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                                      >
                                        Edit Question
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleArchiveQuestion(
                                            question.question_number,
                                          )
                                        }
                                        className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-slate-100"
                                      >
                                        Archive Question
                                      </button>
                                    </>
                                  )}

                                  {question.availability_status ===
                                    "archived" && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleRestoreQuestion(
                                            question.question_number,
                                          )
                                        }
                                        className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                                      >
                                        Restore Question
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeleteQuestion(
                                            question.question_number,
                                          )
                                        }
                                        className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-slate-100"
                                      >
                                        Delete Question
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 space-y-4 text-sm text-slate-600">
                          {isExpanded ? (
                            (question.blocks ?? []).map((block, index) => {
                              if (block.block_type === "image") {
                                return (
                                  <img
                                    key={`${question.id}-block-${index}`}
                                    src={block.content}
                                    alt={`Question block ${index + 1}`}
                                    className="max-h-96 w-auto rounded-lg border border-slate-200"
                                  />
                                );
                              }

                              return (
                                <p
                                  key={`${question.id}-block-${index}`}
                                  className="whitespace-pre-wrap"
                                >
                                  {block.content}
                                </p>
                              );
                            })
                          ) : (
                            <p className="whitespace-pre-wrap">
                              {(() => {
                                const preview =
                                  getQuestionTextPreview(question);
                                return preview.length > 220
                                  ? `${preview.slice(0, 220)}...`
                                  : preview;
                              })()}
                            </p>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {question.question_topics?.map((topicObj) => (
                            <span
                              key={`${question.id}-${topicObj.topic}`}
                              className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
                            >
                              {topicObj.topic}
                            </span>
                          ))}
                        </div>

                        {editingQuestionId === question.id && (
                          <form
                            onSubmit={(e) =>
                              handleEditQuestion(e, question.question_number)
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="mt-6 space-y-4 rounded-xl border border-slate-200 p-4"
                          >
                            <h4 className="text-md font-semibold text-slate-800">
                              Edit Question
                            </h4>

                            <div>
                              <label className="mb-1 block text-sm font-medium text-slate-700">
                                Title
                              </label>
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => {
                                  setEditTitle(e.target.value);
                                  setEditError("");
                                  setEditMessage("");
                                }}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                              />
                            </div>

                            <div>
                              <label className="mb-1 block text-sm font-medium text-slate-700">
                                Description
                              </label>
                              <textarea
                                rows={6}
                                value={editDescription}
                                onChange={(e) => {
                                  setEditDescription(e.target.value);
                                  setEditError("");
                                  setEditMessage("");
                                }}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                              />
                            </div>

                            <div>
                              <label className="mb-1 block text-sm font-medium text-slate-700">
                                Difficulty
                              </label>
                              <select
                                value={editDifficulty}
                                onChange={(e) => {
                                  setEditDifficulty(e.target.value);
                                  setEditError("");
                                  setEditMessage("");
                                }}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                              >
                                <option value="">Select difficulty</option>
                                <option value="easy">Easy</option>
                                <option value="medium">Medium</option>
                                <option value="hard">Hard</option>
                              </select>
                            </div>

                            <div>
                              <p className="mb-2 block text-sm font-medium text-slate-700">
                                Topics
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {topics.map((topic) => {
                                  const selected = editTopics.includes(
                                    topic.name,
                                  );
                                  return (
                                    <button
                                      key={topic.name}
                                      type="button"
                                      onClick={() => {
                                        toggleEditTopic(topic.name);
                                        setEditError("");
                                        setEditMessage("");
                                      }}
                                      className={`rounded-full px-3 py-1 text-sm transition ${
                                        selected
                                          ? "bg-blue-600 text-white"
                                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                      }`}
                                    >
                                      {topic.name}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {editMessage && (
                              <p className="text-sm text-green-600">
                                {editMessage}
                              </p>
                            )}
                            {editError && (
                              <p className="text-sm text-red-500">
                                {editError}
                              </p>
                            )}

                            <div className="flex gap-3">
                              <button
                                type="submit"
                                disabled={editing}
                                className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                              >
                                {editing ? "Saving..." : "Save Changes"}
                              </button>

                              <button
                                type="button"
                                onClick={cancelEditing}
                                className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-100"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === "users" && (
        <div className="mt-8 rounded-xl border border-slate-200 p-5">
          <h2 className="text-lg font-semibold text-slate-800">
            Promote Users to Admin
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            View all registered users and promote selected users to admin.
          </p>

          <div className="mt-6">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Search Username
            </label>
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search users by username"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          {userMessage && (
            <p className="mt-4 text-sm text-green-600">{userMessage}</p>
          )}
          {userError && (
            <p className="mt-4 text-sm text-red-500">{userError}</p>
          )}

          <div className="mt-6">
            {loadingUsers ? (
              <p className="text-sm text-slate-500">Loading users...</p>
            ) : filteredUsers.length === 0 ? (
              <p className="text-sm text-slate-500">No users found.</p>
            ) : (
              <div className="max-h-125 overflow-auto rounded-xl border border-slate-200">
                <div className="divide-y divide-slate-200">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between gap-4 p-4"
                    >
                      <div>
                        <p className="font-medium text-slate-800">
                          {user.username}
                        </p>
                        <p className="text-sm text-slate-500">{user.id}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            user.isAdmin
                              ? "bg-green-100 text-green-700"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {user.isAdmin ? "Admin" : "User"}
                        </span>

                        {!user.isAdmin && (
                          <button
                            type="button"
                            onClick={() => handlePromoteUser(user)}
                            disabled={promotingUserId === user.id}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            {promotingUserId === user.id
                              ? "Promoting..."
                              : "Promote"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
