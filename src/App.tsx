import { useState, useEffect } from "react";
import { Authenticator } from "@aws-amplify/ui-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";
import "@aws-amplify/ui-react/styles.css";

// Initialize the Data client
const client = generateClient<Schema>();

export default function App() {
  const [todos, setTodos] = useState<Array<Schema["Todo"]["type"]>>([]);

  // Fetch data and subscribe to real-time updates
  useEffect(() => {
    const sub = client.models.Todo.observeQuery().subscribe({
      next: ({ items }) => setTodos([...items]),
    });
    return () => sub.unsubscribe();
  }, []);

  // Create a new Todo with the new fields
  async function createTodo() {
    const userInput = window.prompt("Todo content");
    if (!userInput) return;

    await client.models.Todo.create({
      content: userInput,
      isDone: false,
      priority: 'MEDIUM', // Default priority
      dueDate: new Date().toISOString().split('T')[0], // Today's date (YYYY-MM-DD)
    });
  }

  // Delete function
  async function deleteTodo(id: string) {
    await client.models.Todo.delete({ id });
  }

  // Toggle Done/Not Done
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
          <h1>My Tasks</h1>
          <p>Logged in as: <strong>{user?.signInDetails?.loginId}</strong></p>
          
          <div style={{ marginBottom: "20px" }}>
            <button onClick={createTodo} style={{ padding: "10px 20px", cursor: "pointer", backgroundColor: "#047d95", color: "white", border: "none", borderRadius: "4px" }}>
              + New Todo
            </button>
            <button onClick={signOut} style={{ marginLeft: "10px", padding: "10px 20px", cursor: "pointer" }}>
              Sign out
            </button>
          </div>

          <ul style={{ listStyle: "none", padding: 0 }}>
            {todos.map((todo) => (
              <li 
                key={todo.id} 
                style={{ 
                  border: "1px solid #ddd", 
                  borderRadius: "8px",
                  padding: "15px", 
                  marginBottom: "15px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <input 
                      type="checkbox" 
                      checked={todo.isDone || false} 
                      onChange={() => toggleTodo(todo)}
                    />
                    <span style={{ 
                      fontWeight: "bold", 
                      textDecoration: todo.isDone ? "line-through" : "none",
                      color: todo.isDone ? "#888" : "#000"
                    }}>
                      {todo.content}
                    </span>
                  </div>
                  <button 
                    onClick={() => deleteTodo(todo.id)} 
                    style={{ backgroundColor: "#ff4d4d", color: "white", border: "none", borderRadius: "4px", padding: "5px 10px", cursor: "pointer" }}
                  >
                    Delete
                  </button>
                </div>

                <div style={{ fontSize: "0.85rem", color: "#666", display: "flex", gap: "15px" }}>
                  <span><strong>Priority:</strong> {todo.priority || 'N/A'}</span>
                  <span><strong>Due:</strong> {todo.dueDate || 'No date'}</span>
                  <span><strong>Added:</strong> {todo.createdAt ? new Date(todo.createdAt).toLocaleDateString() : 'Just now'}</span>
                </div>
              </li>
            ))}
          </ul>
        </main>
      )}
    </Authenticator>
  );
}
