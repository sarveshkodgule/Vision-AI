import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from bson import ObjectId
from fastapi import HTTPException
from services import auth_service
from utils import dependencies


class AccountLifecycleTests(unittest.IsolatedAsyncioTestCase):
    async def test_deactivated_account_cannot_password_login(self):
        user = {"_id": ObjectId(), "email": "inactive@example.com", "is_active": False, "password": "hash"}
        with patch.object(auth_service.users_collection, "find_one", new_callable=AsyncMock, return_value=user):
            with self.assertRaises(HTTPException):
                await auth_service.authenticate_user(user["email"], "password")

    async def test_deactivate_account_updates_only_active_account(self):
        user_id = str(ObjectId())
        with patch.object(auth_service.users_collection, "update_one", new_callable=AsyncMock, return_value=SimpleNamespace(modified_count=1)) as update:
            await auth_service.deactivate_user(user_id)
            self.assertEqual(update.call_args.args[0]["is_active"], {"$ne": False})
            self.assertFalse(update.call_args.args[1]["$set"]["is_active"])

    async def test_deactivated_token_user_is_rejected(self):
        token_user = {"_id": ObjectId(), "is_active": False}
        with patch("database.mongodb.blacklist_tokens_collection.find_one", new_callable=AsyncMock, return_value=None), \
                patch.object(dependencies.users_collection, "find_one", new_callable=AsyncMock, return_value=token_user), \
                patch("utils.dependencies.jwt.decode", return_value={"sub": str(token_user["_id"])}):
            with self.assertRaises(HTTPException):
                await dependencies.get_current_user("token")


if __name__ == "__main__":
    unittest.main()
