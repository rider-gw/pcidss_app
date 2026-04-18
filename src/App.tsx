import { useState, useEffect } from "react";
import { Authenticator } from "@aws-amplify/ui-react";
import { generateClient } from "aws-amplify/data";
//import { fetchAuthSession } from 'aws-amplify/auth'; // 1. Added this import
import type { Schema } from "../amplify/data/resource";
import "@aws-amplify/ui-react/styles.css";
import { fetchAuthSession, fetchUserAttributes } from 'aws-amplify/auth'; // Added fetchUserAttributes

const client = generateClient<Schema>();

export default function App() {
  const [todos, setTodos] = useState<Array<Schema["Todo"]["type"]>>([]);
  const [userGroups, setUserGroups] = useState<string[]>([]); // 2. New state for groups
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<Schema["Todo"]["type"]["priority"]>("MEDIUM");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [lastLogin, setLastLogin] = useState("");

  // 3. New Effect to fetch groups safely
  /*useEffect(() => {
    const checkGroups = async () => {
      try {
        const session = await fetchAuthSession();
        const groups = session.tokens?.accessToken?.payload?.['cognito:groups'] as string[] || [];
        setUserGroups(groups);
      } catch (err) {
        console.error("Error fetching groups:", err);
      }
    };
    
    checkGroups();

    const sub = client.models.Todo.observeQuery().subscribe({
      next: ({ items }) => setTodos([...items]),
    });
    return () => sub.unsubscribe();
  }, []);
  */

  useEffect(() => {
  const fetchUserDetails = async () => {
    try {
      // 1. Fetch Groups
      const session = await fetchAuthSession();
      const groups = session.tokens?.accessToken?.payload?.['cognito:groups'] as string[] || [];
      setUserGroups(groups);

      // 2. Fetch Email Attribute
      const attributes = await fetchUserAttributes();
      setUserEmail(attributes.email || "Unknown User");

      // 3. Set Last Login (Using current session time for now)
      // In a pro GRC app, we'd save this to a database on every login.
      setLastLogin(new Date().toLocaleString());
      
    } catch (err) {
      console.error("Error fetching user details:", err);
    }
  };
  
  fetchUserDetails();

  const sub = client.models.Todo.observeQuery().subscribe({
    next: ({ items }) => setTodos([...items]),
  });
  return () => sub.unsubscribe();
}, []);



  async function createTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!content) return;
    await client.models.Todo.create({ content, isDone: false, priority, dueDate });
    setContent("");
  }

  async function deleteTodo(id: string) {
    await client.models.Todo.delete({ id });
  }

  async function toggleTodo(todo: Schema["Todo"]["type"]) {
    await client.models.Todo.update({ id: todo.id, isDone: !todo.isDone });
  }

  return (
    <Authenticator>
      {({ signOut, user }) => (
        <main style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
          
          <div style={{ background: '#eee', padding: '10px', fontSize: '12px', marginBottom: '20px', borderRadius: '4px' }}>
            <strong>Debug - Your Groups:</strong> {JSON.stringify(userGroups)}
          </div>

         {/*
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h1>My Tasks</h1>
            <button onClick={signOut}>Sign out</button>
          </div>
          */}

          <div style={{ borderBottom: '2px solid #047d95', marginBottom: '20px', paddingBottom: '10px' }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
         <h1>PCI Audit Portal</h1>
         <button onClick={signOut}>Sign out</button>
         </div>
  
        <div style={{ fontSize: '0.9rem', color: '#555' }}>
            <p style={{ margin: '5px 0' }}>Logged in as: <strong>{userEmail}</strong></p>
            <p style={{ margin: '5px 0' }}>Session Started: <strong>{lastLogin}</strong></p>
            <p style={{ margin: '5px 0' }}>Roles: <strong>{userGroups.join(", ") || "No Roles Assigned"}</strong></p>
         </div>
</div>


          {/* This will now reliably see the "ADMIN" string */}
          {userGroups.includes("ADMIN") && (
            <div style={{ backgroundColor: "#f3e5f5", padding: "15px", borderRadius: "8px", marginBottom: "20px", border: "1px solid purple" }}>
              <strong style={{ color: "purple" }}>Admin Mode Active</strong>
              <button style={{ marginLeft: "15px", backgroundColor: "purple", color: "white", border: "none", padding: "5px 10px", borderRadius: "4px" }}>
                PCI AUDIT LOGS
              </button>
            </div>
          )}

          <form onSubmit={createTodo} style={{ backgroundColor: "#f9f9f9", padding: "20px", borderRadius: "8px", marginBottom: "30px", display: "flex", flexDirection: "column", gap: "10px", border: "1px solid #eee" }}>
            <input placeholder="What needs doing?" value={content} onChange={(e) => setContent(e.target.value)} style={{ padding: "10px", borderRadius: "4px", border: "1px solid #ccc" }} />
            <div style={{ display: "flex", gap: "10px" }}>
              <select value={priority} onChange={(e) => setPriority(e.target.value as any)} style={{ flex: 1, padding: "8px" }}>
                <option value="LOW">Low Priority</option>
                <option value="MEDIUM">Medium Priority</option>
                <option value="HIGH">High Priority</option>
              </select>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ flex: 1, padding: "8px" }} />
            </div>
            <button type="submit" style={{ padding: "10px", backgroundColor: "#047d95", color: "white", border: "none", borderRadius: "4px", fontWeight: "bold" }}>Add Task</button>
          </form>

          <div style={{ marginBottom: "20px" }}>
            <input type="text" placeholder="Search tasks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid #ddd" }} />
          </div>

          <ul style={{ listStyle: "none", padding: 0 }}>
            {todos
              .filter((todo) => todo.content?.toLowerCase().includes(searchQuery.toLowerCase()))
              .slice()
              .sort((a, b) => {
                if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
                const weights: Record<string, number> = { HIGH: 1, MEDIUM: 2, LOW: 3 };
                const weightA = weights[a.priority as string] || 2;
                const weightB = weights[b.priority as string] || 2;
                if (weightA !== weightB) return weightA - weightB;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
              })
              .map((todo) => (
                <li key={todo.id} style={{ border: "1px solid #ddd", borderRadius: "8px", padding: "15px", marginBottom: "15px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <input type="checkbox" checked={todo.isDone || false} onChange={() => toggleTodo(todo)} />
                      <span style={{ fontWeight: "bold", textDecoration: todo.isDone ? "line-through" : "none" }}>{todo.content}</span>
                    </div>
                    <button onClick={() => deleteTodo(todo.id)} style={{ color: "red", border: "none", background: "none" }}>Delete</button>
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

