import { useState, useEffect } from "react";
import { Authenticator } from "@aws-amplify/ui-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";
import "@aws-amplify/ui-react/styles.css";

// Initialize the Data client
const client = generateClient<Schema>();

export default function App() {
  const [todos, setTodos] = useState<Array<Schema["Todo"]["type"]>>([]);

  // Function to fetch data from the API
  useEffect(() => {
    const sub = client.models.Todo.observeQuery().subscribe({
      next: ({ items }) => setTodos([...items]),
    });
    return () => sub.unsubscribe();
  }, []);

  // Function to create a new item
  async function createTodo() {
    await client.models.Todo.create({
      content: window.prompt("Todo content"),
      isDone: false,
    });
  }

  // Function to delete an item
  async function deleteTodo(id: string) {
    await client.models.Todo.delete({ id });
  }

  return (
    <Authenticator>
      {({ signOut, user }) => (
        <main style={{ padding: "2rem" }}>
          <h1>My App Content</h1>
          <p>Logged in as: {user?.signInDetails?.loginId}</p>
          
          <button onClick={createTodo} style={{ marginRight: "10px" }}>
            + New Todo
          </button>
          <button onClick={signOut}>Sign out</button>

          <ul style={{ marginTop: "20px" }}>
            {todos.map((todo) => (
              <li 
                key={todo.id} 
                onClick={() => deleteTodo(todo.id)}
                style={{ cursor: 'pointer', marginBottom: '5px' }}
              >
                {todo.content} (click to delete)
              </li>
            ))}
          </ul>
        </main>
      )}
    </Authenticator>
  );
}

