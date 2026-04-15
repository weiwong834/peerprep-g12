const API_BASE =
  import.meta.env.VITE_QUESTION_SERVICE_URL || "http://localhost:3001";

export async function uploadQuestionImage(file: File): Promise<string> {
  console.log("uploadQuestionImage called", file);
  const token = localStorage.getItem("accessToken");

  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(`${API_BASE}/questions/images/upload`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Image upload failed.");
  }

  return data.url;
}