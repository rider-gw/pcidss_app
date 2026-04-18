import { useState, useEffect } from "react";
import { Authenticator } from "@aws-amplify/ui-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";
import "@aws-amplify/ui-react/styles.css";

const client = generateClient<Schema>();

export default function App() {
  const [todos, setTodos] = useState<Array<Schema["Todo"]["type"]>>([]);
  
  // --- New Form State ---
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<Schema["Todo"]["type"]["priority"]>("MEDIUM");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState("");


  useEffect(() => {
    const sub = client.models.Todo.observeQuery().subscribe({
      next: ({ items }) => setTodos([...items]),
    });
    return () => sub.unsubscribe();
  }, []);

  async function createTodo(e: React.FormEvent) {
    e.preventDefault(); // Stop page from refreshing
    if (!content) return;

    await client.models.Todo.create({
      content,
      isDone: false,
      priority,
      dueDate,
    });

    // Reset form after saving
    setContent("");
  }

  async function deleteTodo(id: string) {
    await client.models.Todo.delete({ id });
  }

  async function toggleTodo(todo: Schema["Todo"]["type"]) {
    await client.models.Todo.update({
      id: todo.id,
      isDone: !todo.isDone,
    });
  }

  return (
    <Authenticator>
      {({ signOut, user }) => (
        <main style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1>My Tasks</h1>
            <button onClick={signOut} style={{ padding: "5px 10px" }}>Sign out</button>
          </div>

          {/* --- New Form UI --- */}
          <form onSubmit={createTodo} style={{ 
            backgroundColor: "#f9f9f9", 
            padding: "20px", 
            borderRadius: "8px", 
            marginBottom: "30px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            border: "1px solid #eee"
          }}>
            <input 
              placeholder="What needs doing?" 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              style={{ padding: "10px", borderRadius: "4px", border: "1px solid #ccc" }}
            />
            
            <div style={{ display: "flex", gap: "10px" }}>
              <select 
                value={priority} 
                onChange={(e) => setPriority(e.target.value as any)}
                style={{ flex: 1, padding: "8px" }}
              >
                <option value="LOW">Low Priority</option>
                <option value="MEDIUM">Medium Priority</option>
                <option value="HIGH">High Priority</option>
              </select>

              <input 
                type="date" 
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={{ flex: 1, padding: "8px" }}
              />
            </div>

            <button type="submit" style={{ 
              padding: "10px", 
              backgroundColor: "#047d95", 
              color: "white", 
              border: "none", 
              borderRadius: "4px", 
              fontWeight: "bold",
              cursor: "pointer"
            }}>
              Add Task
            </button>
          </form>

<div style={{ marginBottom: "20px" }}>
  <input 
    type="text"
    placeholder="Search tasks..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    style={{ 
      width: "100%", 
      padding: "10px", 
      borderRadius: "4px", 
      border: "1px solid #ddd",
      boxSizing: "border-box" 
    }}
  />
</div>


          {/* --- List UI --- */}
          <ul style={{ listStyle: "none", padding: 0 }}>
            {todos
  .filter((todo) => 
    todo.content?.toLowerCase().includes(searchQuery.toLowerCase())
  )
              .slice() // Important: creates a copy so React doesn't get confused
  .sort((a, b) => {
    // 1. Sort by completion (Unfinished on top)
    if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;

    // 2. Define priority weights
    const weights: Record<string, number> = { HIGH: 1, MEDIUM: 2, LOW: 3 };

    // 3. Get weights (default to 2 if something goes wrong)
    const weightA = weights[a.priority as string] || 2;
    const weightB = weights[b.priority as string] || 2;

    // 4. Sort by priority weight
    if (weightA !== weightB) return weightA - weightB;

    // 5. If priorities are equal, sort by newest first
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            })
            .map((todo) => (
              <li key={todo.id} style={{ border: "1px solid #ddd", borderRadius: "8px", padding: "15px", marginBottom: "15px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <input type="checkbox" checked={todo.isDone || false} onChange={() => toggleTodo(todo)} />
                    <span style={{ fontWeight: "bold", textDecoration: todo.isDone ? "line-through" : "none" }}>
                      {todo.content}
                    </span>
                  </div>
                  <button onClick={() => deleteTodo(todo.id)} style={{ color: "red", border: "none", background: "none", cursor: "pointer" }}>Delete</button>
                </div>
                <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "10px" }}>
                  <strong>{todo.priority}</strong> • Due: {todo.dueDate} • Added: {new Date(todo.createdAt).toLocaleDateString()}
                </div>
              </li>
            ))}
          </ul>
        </main>
      )}
    </Authenticator>
  );
}
