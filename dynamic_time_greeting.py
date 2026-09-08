import sys, pathlib

path = pathlib.Path("src/App.tsx")
if not path.exists():
    print("ERROR: run this from the root of the O-frontend repo (src/App.tsx not found)")
    sys.exit(1)

text = path.read_text()
changes = 0

# 1. Add getTimeGreeting() helper above MobileLanding
old1 = '''}

function MobileLanding() {
  const { navigate } = useRouter();'''
new1 = '''}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function MobileLanding() {
  const { navigate } = useRouter();'''
if old1 in text:
    text = text.replace(old1, new1, 1)
    changes += 1

# 2. Add timeGreeting state
old2 = '''  const { state: nearState, locate, clear, sorted: sortedByDistance } = useNearMe(hospitals);
'''
new2 = '''  const { state: nearState, locate, clear, sorted: sortedByDistance } = useNearMe(hospitals);
  const [timeGreeting, setTimeGreeting] = useMobileState(getTimeGreeting());
'''
if old2 in text:
    text = text.replace(old2, new2, 1)
    changes += 1

# 3. Add refresh interval effect
old3 = '''  }, [nearState.status]);

  // Drag handle logic
  function onDragStart(clientY: number) {'''
new3 = '''  }, [nearState.status]);

  useEffect(() => {
    const id = setInterval(() => setTimeGreeting(getTimeGreeting()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Drag handle logic
  function onDragStart(clientY: number) {'''
if old3 in text:
    text = text.replace(old3, new3, 1)
    changes += 1

# 4. Replace the static "Hello" block with the time-based greeting, 24px/16px
old4 = '''        <div className="px-5 pt-12 pb-28">
          <h1 className="text-xl font-bold text-gray-900 mb-8">
            {user ? `Hello, ${(user as { name: string }).name}` : "Hello"}
          </h1>
          <button
            type="button"'''
new4 = '''        <div className="px-5 pt-12 pb-28">
          <div className="mb-8">
            <p style={{ fontSize: 24, lineHeight: 1.3 }} className="font-bold text-gray-900">{timeGreeting}</p>
            {user && (
              <p style={{ fontSize: 16 }} className="font-medium text-gray-500 mt-1">{(user as { name: string }).name}</p>
            )}
          </div>
          <button
            type="button"'''
if old4 in text:
    text = text.replace(old4, new4, 1)
    changes += 1

if changes != 4:
    print(f"ERROR: only {changes}/4 expected blocks matched — file may not be in the expected state.")
    print("Paste me `grep -n \"Hello\\|timeGreeting\\|nearState.status\" src/App.tsx` and I'll adjust.")
    sys.exit(1)

path.write_text(text)
print("SUCCESS: time-of-day greeting (24px) + name (16px) added, refreshing every 60s.")
