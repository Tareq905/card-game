import psycopg2
conn = psycopg2.connect('postgresql://postgres:admin@localhost:5432/one_left')
cur = conn.cursor()
cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position;")
print("USERS TABLE COLUMNS:")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]}")

cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'matches' ORDER BY ordinal_position;")
print("\nMATCHES TABLE COLUMNS:")
for row in cur.fetchall():
    print(f"  {row[0]}")

cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
print("\nALL TABLES:")
for row in cur.fetchall():
    print(f"  {row[0]}")
