import sys, pathlib

path = pathlib.Path("src/App.tsx")
if not path.exists():
    print("ERROR: run this from the root of the O-frontend repo (src/App.tsx not found)")
    sys.exit(1)

text = path.read_text()

old_block = '''      {/* Feature cards — replaces the hospital results list */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="px-5 pt-6 pb-28">
          <button'''

new_block = '''      {/* Feature cards — replaces the hospital results list */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="px-5 pt-12 pb-28">
          <h1 className="text-xl font-bold text-gray-900 mb-8">
            {user ? `Hello, ${(user as { name: string }).name}` : "Hello"}
          </h1>
          <button'''

if old_block not in text:
    print("ERROR: expected marker not found — file may not match what this script assumes.")
    print("Paste me `grep -n \"Feature cards\" src/App.tsx` and the ~15 lines after it.")
    sys.exit(1)

text = text.replace(old_block, new_block, 1)
path.write_text(text)
print("SUCCESS: greeting added, cards shifted down.")
