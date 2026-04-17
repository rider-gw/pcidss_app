import { useState, useEffect } from "react";
import { Authenticator } from "@aws-amplify/ui-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";
import "@aws-amplify/ui-react/styles.css";

// 1. Client is created outside the component
const client = generateClient<Schema>();

export default function App() {
  // 2. State goes INSIDE the component at the very top
  const [todos, setTodos] = useState<Array<Schema["Todo"]["type"]>>([]);

  // 3. Effect to fetch data automatically
  useEffect(() => {
    const sub = client.models.Todo.observeQuery().subscribe({
      next: ({ items }) => setTodos([...items]),
    });
    return () => sub.unsubscribe();
  }, []);

  // 4. Fixed create function with type safety
  async function createTodo() {
    const userInput = window.prompt("Todo content");
    if (!userInput) return;

    await client.models.Todo.create({
      content: userInput, // TypeScript thinks this should be an array
      isDone: false,      // TypeScript thinks this should be an array
    });
  }


  return (
    <Authenticator>
      {({ signOut, user }) => (
        <main style={{ padding: "2rem" }}>
          <h1>Hello {user?.signInDetails?.loginId}</h1>
          <button onClick={createTodo}>+ New Todo</button>
          <button onClick={signOut} style={{ marginLeft: "10px" }}>Sign out</button>

          <ul>
            {todos.map((todo) => (
              <li key={todo.id}>{todo.content}</li>
            ))}
          </ul>
        </main>
      )}
    </Authenticator>
  );
}
