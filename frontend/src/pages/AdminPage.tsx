// AI Assistance Disclosure:
// Tool: ChatGPT (model: GPT-5.4 Thinking), date: 2026-03-18
// Scope: Assisted with the styling and formatting of the question card layout in the Question Bank view
// Author review: I reviewed, modified, and tested the suggested changes before incorporating them into the file.
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
import { FiCheck, FiChevronDown } from "react-icons/fi";
import { Listbox } from "@headlessui/react";
import { getAllUsers, promoteUser } from "../services/userService";
import QuestionDisplay from "../components/QuestionDisplay";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";
import ImageTextarea from "../components/ImageTextarea";

type AdminUser = {
  id: string;
  username: string;
  isAdmin: boolean;
};

type DropdownOption = {
  value: string;
  label: string;
};

function CustomDropdown({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder: string;
  disabled?: boolean;
}) {
  const selectedOption =
    options.find((option) => option.value === value) ?? null;

  return (
    <Listbox value={value} onChange={onChange} disabled={disabled}>
      <div className="relative">
        <Listbox.Button
          className={`relative w-full rounded-xl border bg-white px-3 py-2.5 pr-10 text-left shadow-sm transition ${
            disabled
              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
              : "border-slate-300 text-slate-800 hover:border-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          }`}
        >
          <span className={selectedOption ? "" : "text-slate-400"}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>

          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500">
            <FiChevronDown className="h-5 w-5" />
          </span>
        </Listbox.Button>

        <Listbox.Options className="absolute z-20 mt-2 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg focus:outline-none">
          {options.map((option) => (
            <Listbox.Option
              key={option.value}
              value={option.value}
              className={({ active }) =>
                `relative cursor-pointer select-none px-4 py-2.5 ${
                  active ? "bg-indigo-50 text-indigo-700" : "text-slate-700"
                }`
              }
            >
              {({ selected }) => (
                <div className="flex items-center justify-between">
                  <span className={selected ? "font-medium" : "font-normal"}>
                    {option.label}
                  </span>
                  {selected && <FiCheck className="h-4 w-4 text-indigo-600" />}
                </div>
              )}
            </Listbox.Option>
          ))}
        </Listbox.Options>
      </div>
    </Listbox>
  );
}

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

  const [currentQuestionPage, setCurrentQuestionPage] = useState(1);
  const QUESTIONS_PER_PAGE = 30;

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userError, setUserError] = useState("");
  const [userMessage, setUserMessage] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [promotingUserId, setPromotingUserId] = useState<string | null>(null);

  const [confirmingAction, setConfirmingAction] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    confirmVariant?: "indigo" | "red";
    onConfirm: (() => Promise<void> | void) | null;
  }>({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    confirmVariant: "indigo",
    onConfirm: null,
  });

  const topicOptions = [
    { value: "", label: "All topics" },
    ...topics.map((topic) => ({ value: topic.name, label: topic.name })),
  ];

  const difficultyOptions = [
    { value: "", label: "All difficulties" },
    { value: "easy", label: "Easy" },
    { value: "medium", label: "Medium" },
    { value: "hard", label: "Hard" },
  ];

  const statusOptions = [
    { value: "", label: "All statuses" },
    { value: "available", label: "Available" },
    { value: "archived", label: "Archived" },
  ];

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
    setCurrentQuestionPage(1);
  }, [selectedTopic, selectedDifficulty, selectedStatus, questionSearch]);

  useEffect(() => {
    if (activeTab === "users") {
      loadUsers();
    }
  }, [activeTab]);

  function openConfirmModal(config: {
    title: string;
    message: string;
    confirmText: string;
    confirmVariant?: "indigo" | "red";
    onConfirm: () => Promise<void> | void;
  }) {
    setConfirmModal({
      isOpen: true,
      title: config.title,
      message: config.message,
      confirmText: config.confirmText,
      confirmVariant: config.confirmVariant ?? "indigo",
      onConfirm: config.onConfirm,
    });
  }

  function closeConfirmModal() {
    if (confirmingAction) return;

    setConfirmModal({
      isOpen: false,
      title: "",
      message: "",
      confirmText: "Confirm",
      confirmVariant: "indigo",
      onConfirm: null,
    });
  }

  async function handleConfirmModalAction() {
    if (!confirmModal.onConfirm) return;

    try {
      setConfirmingAction(true);
      await confirmModal.onConfirm();
      setConfirmModal({
        isOpen: false,
        title: "",
        message: "",
        confirmText: "Confirm",
        confirmVariant: "indigo",
        onConfirm: null,
      });
    } finally {
      setConfirmingAction(false);
    }
  }

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
    return (question.blocks ?? [])
      .map((block) =>
        block.block_type === "image"
          ? `[image:${block.content}]`
          : block.content,
      )
      .join("\n\n");
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
    openConfirmModal({
      title: "Save Changes?",
      message:
        "Are you sure you want to edit this question? The current version will be superseded.",
      confirmText: "Save Changes",
      confirmVariant: "indigo",
      onConfirm: async () => {
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
      },
    });

    return;
  }

  function handleArchiveQuestion(questionNumber: string | number) {
    openConfirmModal({
      title: "Archive Question?",
      message: "Are you sure you want to archive this question?",
      confirmText: "Archive",
      confirmVariant: "red",
      onConfirm: async () => {
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
      },
    });
  }

  function handleRestoreQuestion(questionNumber: string | number) {
    openConfirmModal({
      title: "Restore Question?",
      message: "Are you sure you want to restore this question?",
      confirmText: "Restore",
      confirmVariant: "indigo",
      onConfirm: async () => {
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
      },
    });
  }

  function handleDeleteQuestion(questionNumber: string | number) {
    openConfirmModal({
      title: "Delete Question?",
      message:
        "This will permanently delete the archived question and cannot be undone.",
      confirmText: "Delete",
      confirmVariant: "red",
      onConfirm: async () => {
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
      },
    });
  }

  function handlePromoteUser(user: AdminUser) {
    openConfirmModal({
      title: "Promote User?",
      message: `Are you sure you want to promote "${user.username}" to admin?`,
      confirmText: "Promote",
      confirmVariant: "indigo",
      onConfirm: async () => {
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
      },
    });
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

  const totalQuestionPages = Math.max(
    1,
    Math.ceil(filteredQuestions.length / QUESTIONS_PER_PAGE),
  );

  const paginatedQuestions = filteredQuestions.slice(
    (currentQuestionPage - 1) * QUESTIONS_PER_PAGE,
    currentQuestionPage * QUESTIONS_PER_PAGE,
  );

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

      <div className="mt-6 flex gap-2 rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setActiveTab("questions")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            activeTab === "questions"
              ? "bg-white text-indigo-600 shadow-sm"
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
              ? "bg-white text-indigo-600 shadow-sm"
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

            <form onSubmit={handleCreateQuestion} className="mt-6 space-y-4">
              <div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setCreateError("");
                    setCreateMessage("");
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                  placeholder="Enter question title"
                />
              </div>

              <div>
                {/* <textarea
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setCreateError("");
                    setCreateMessage("");
                  }}
                  rows={6}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                  placeholder="Enter question description"
                />
                <p className="mt-1 text-xs text-slate-500">
                  To insert an image, use: [image:https://example.com/image.png]
                </p> */}
                <ImageTextarea
                  value={description}
                  onChange={(val) => {
                    setDescription(val);
                    setCreateError("");
                    setCreateMessage("");
                  }}
                  rows={6}
                  placeholder="Enter question description"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              <div>
                <CustomDropdown
                  value={difficulty}
                  onChange={(value) => {
                    setDifficulty(value);
                    setCreateError("");
                    setCreateMessage("");
                  }}
                  options={[
                    { value: "", label: "Select difficulty" },
                    { value: "easy", label: "Easy" },
                    { value: "medium", label: "Medium" },
                    { value: "hard", label: "Hard" },
                  ]}
                  placeholder="Select difficulty"
                />
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
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                        placeholder="Enter new topic name"
                      />
                      <button
                        type="button"
                        onClick={handleCreateTopic}
                        disabled={creatingTopic}
                        className="whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
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
                              ? "bg-indigo-600 text-white"
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
                className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {creating ? "Creating..." : "Create Question"}
              </button>
            </form>
          </div>

          <div className="mt-8 rounded-xl border border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-800">
              Question Bank Management
            </h2>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div>
                <CustomDropdown
                  value={selectedTopic}
                  onChange={setSelectedTopic}
                  options={topicOptions}
                  placeholder="All topics"
                  disabled={loadingTopics}
                />
              </div>

              <div>
                <CustomDropdown
                  value={selectedDifficulty}
                  onChange={setSelectedDifficulty}
                  options={difficultyOptions}
                  placeholder="All difficulties"
                />
              </div>

              <div>
                <CustomDropdown
                  value={selectedStatus}
                  onChange={setSelectedStatus}
                  options={statusOptions}
                  placeholder="All statuses"
                />
              </div>
            </div>

            <div className="mt-4">
              <input
                type="text"
                value={questionSearch}
                onChange={(e) => setQuestionSearch(e.target.value)}
                placeholder="Search by title, topic, content, or #question-number"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
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
                  {paginatedQuestions.map((question) => {
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
                              <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700">
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
                            <QuestionDisplay
                              question={question}
                              showTitle={false}
                            />
                          ) : (
                            <div className="text-sm text-slate-600">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                rehypePlugins={[rehypeHighlight]}
                                components={{
                                  code({ className, children, ...props }) {
                                    const isInline = !className;
                                    return isInline ? (
                                      <code
                                        className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-sm font-mono"
                                        {...props}
                                      >
                                        {children}
                                      </code>
                                    ) : (
                                      <code className={className} {...props}>
                                        {children}
                                      </code>
                                    );
                                  },
                                }}
                              >
                                {(() => {
                                  const preview =
                                    getQuestionTextPreview(question);
                                  return preview.length > 220
                                    ? `${preview.slice(0, 220)}...`
                                    : preview;
                                })()}
                              </ReactMarkdown>
                            </div>
                          )}
                          {/* {isExpanded ? (
                            (question.blocks ?? []).map((block, index) => {
                              if (block.block_type === "image") {
                                return (
                                  <div key={`${question.id}-block-${index}`}>
                                    <img
                                      src={block.content}
                                      alt={`Question block ${index + 1}`}
                                      className="max-h-96 w-auto rounded-lg border border-slate-200"
                                      onError={(e) => {
                                        e.currentTarget.style.display = "none";
                                        const next = e.currentTarget
                                          .nextElementSibling as HTMLElement | null;
                                        if (next) next.style.display = "block";
                                      }}
                                    />
                                    <p
                                      style={{ display: "none" }}
                                      className="text-sm text-red-500"
                                    >
                                      Image failed to load: {block.content}
                                    </p>
                                  </div>
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
                          )} */}
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
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => {
                                  setEditTitle(e.target.value);
                                  setEditError("");
                                  setEditMessage("");
                                }}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                              />
                            </div>

                            <div>
                              {/* <textarea
                                rows={6}
                                value={editDescription}
                                onChange={(e) => {
                                  setEditDescription(e.target.value);
                                  setEditError("");
                                  setEditMessage("");
                                }}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                              />
                              <p className="mt-1 text-xs text-slate-500">
                                To insert an image, use:
                                [image:https://example.com/image.png]
                              </p> */}
                              <ImageTextarea
                                value={editDescription}
                                onChange={(val) => {
                                  setEditDescription(val);
                                  setEditError("");
                                  setEditMessage("");
                                }}
                                rows={6}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                              />
                            </div>

                            <div>
                              <CustomDropdown
                                value={editDifficulty}
                                onChange={(value) => {
                                  setEditDifficulty(value);
                                  setEditError("");
                                  setEditMessage("");
                                }}
                                options={[
                                  { value: "", label: "Select difficulty" },
                                  { value: "easy", label: "Easy" },
                                  { value: "medium", label: "Medium" },
                                  { value: "hard", label: "Hard" },
                                ]}
                                placeholder="Select difficulty"
                              />
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
                                          ? "bg-indigo-600 text-white"
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
                                className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
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
                  <div className="mt-6 flex items-center justify-between">
                    <p className="text-sm text-slate-500">
                      Showing{" "}
                      {(currentQuestionPage - 1) * QUESTIONS_PER_PAGE + 1}–
                      {Math.min(
                        currentQuestionPage * QUESTIONS_PER_PAGE,
                        filteredQuestions.length,
                      )}{" "}
                      of {filteredQuestions.length} questions
                    </p>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentQuestionPage((prev) =>
                            Math.max(prev - 1, 1),
                          )
                        }
                        disabled={currentQuestionPage === 1}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Previous
                      </button>

                      <span className="text-sm text-slate-600">
                        Page {currentQuestionPage} of {totalQuestionPages}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          setCurrentQuestionPage((prev) =>
                            Math.min(prev + 1, totalQuestionPages),
                          )
                        }
                        disabled={currentQuestionPage === totalQuestionPages}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
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

          <div className="mt-6">
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search users by username"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
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
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
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
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-800">
              {confirmModal.title}
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              {confirmModal.message}
            </p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={closeConfirmModal}
                disabled={confirmingAction}
                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmModalAction}
                disabled={confirmingAction}
                className={`w-full rounded-xl px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                  confirmModal.confirmVariant === "red"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {confirmingAction ? "Processing..." : confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
