"""Local administrator command. Never exposed as a public role-selection API."""
import argparse
import asyncio
import re
from pydantic import TypeAdapter, EmailStr
from database.mongodb import users_collection, client


async def provision(email, name):
    email = str(TypeAdapter(EmailStr).validate_python(email)).lower()
    matches = await users_collection.find({"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}}).to_list(length=2)
    if len(matches) > 1:
        raise SystemExit('Duplicate email records. Resolve them before provisioning staff.')
    if matches:
        await users_collection.update_one({"_id": matches[0]["_id"]}, {"$set": {"role": "doctor", "name": name}})
    else:
        await users_collection.insert_one({"email": email, "name": name, "role": "doctor", "auth_provider": "google"})
    print('Doctor account provisioned. Sign in using the matching Google account.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Provision a verified hospital doctor for Google sign-in.')
    parser.add_argument('--email', required=True)
    parser.add_argument('--name', required=True)
    parser.add_argument('--confirm-doctor', action='store_true', required=True, help='Confirm this person is authorised hospital staff.')
    args = parser.parse_args()
    try:
        asyncio.run(provision(args.email, args.name.strip()))
    finally:
        client.close()
