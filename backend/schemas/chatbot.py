from pydantic import BaseModel, Field, ConfigDict

class ChatQuery(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    message: str = Field(min_length=1, max_length=4000)

class ChatResponse(BaseModel):
    response: str
