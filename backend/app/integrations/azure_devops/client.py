"""Azure DevOps Work Item API client.

Provides an abstract base class and two concrete implementations:
- AzureDevOpsHttpClient  : calls the real REST API
- AzureDevOpsMockClient  : in-memory stub for development / tests
"""
from __future__ import annotations

import base64
import re
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import httpx


@dataclass
class WorkItemData:
    id: int
    rev: int
    fields: Dict[str, Any] = field(default_factory=dict)


class AzureDevOpsClientBase(ABC):
    @abstractmethod
    def get_work_items_batch(
        self, work_item_ids: List[int], fields: List[str]
    ) -> Dict[int, WorkItemData]:
        """Fetch work items by IDs.

        Returns a dict keyed by work_item_id; missing IDs are absent.
        """

    @abstractmethod
    def patch_work_item(
        self, work_item_id: int, patch_ops: List[Dict[str, Any]]
    ) -> WorkItemData:
        """Apply JSON Patch operations and return the updated work item."""

    @abstractmethod
    def get_child_work_items(
        self, parent_work_item_id: int, fields: List[str]
    ) -> List[WorkItemData]:
        """Fetch Work Items linked as children of the parent Work Item."""

    @abstractmethod
    def search_users(self, query: str) -> List[Dict[str, Any]]:
        """Search Azure DevOps users visible to the organization."""


class AzureDevOpsHttpClient(AzureDevOpsClientBase):
    """Real HTTP client using the Azure DevOps REST API v7.1.

    project は省略可能。空文字の場合は organization レベルの URL を使用する。
    Work Item ID は organization 単位で一意なため project 指定は不要。

    Reference:
      batch : POST https://dev.azure.com/{org}[/{project}]/_apis/wit/workitemsbatch
      PATCH : PATCH https://dev.azure.com/{org}[/{project}]/_apis/wit/workitems/{id}
    """

    _RETRY_DELAYS = (1, 3, 10)

    def __init__(
        self,
        organization: str,
        pat: str,
        project: str = "",
        api_version: str = "7.1",
        timeout: int = 30,
        suppress_notifications: bool = False,
    ) -> None:
        token = base64.b64encode(f":{pat}".encode()).decode()
        self._organization = organization
        # project が指定されていない場合は org レベル URL を使用
        if project:
            self._base_url = f"https://dev.azure.com/{organization}/{project}/_apis"
        else:
            self._base_url = f"https://dev.azure.com/{organization}/_apis"
        self._api_version = api_version
        self._timeout = timeout
        self._suppress_notifications = suppress_notifications
        self._auth_headers = {"Authorization": f"Basic {token}"}

    def _request_with_retry(self, method: str, url: str, **kwargs) -> httpx.Response:
        last_exc: Optional[Exception] = None
        for attempt, delay in enumerate((*self._RETRY_DELAYS, None)):
            try:
                resp = httpx.request(method, url, timeout=self._timeout, **kwargs)
                if resp.status_code == 429 and delay is not None:
                    time.sleep(delay)
                    continue
                resp.raise_for_status()
                return resp
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code in (401, 403):
                    raise  # Auth errors are not retried
                last_exc = exc
                if delay is not None:
                    time.sleep(delay)
            except (httpx.TimeoutException, httpx.NetworkError) as exc:
                last_exc = exc
                if delay is not None:
                    time.sleep(delay)
        raise last_exc  # type: ignore[misc]

    def get_work_items_batch(
        self, work_item_ids: List[int], fields: List[str]
    ) -> Dict[int, WorkItemData]:
        url = f"{self._base_url}/wit/workitemsbatch?api-version={self._api_version}"
        results: Dict[int, WorkItemData] = {}

        for i in range(0, len(work_item_ids), 200):
            chunk = work_item_ids[i : i + 200]
            body = {"ids": chunk, "fields": fields, "errorPolicy": "Omit"}
            resp = self._request_with_retry(
                "POST",
                url,
                json=body,
                headers={**self._auth_headers, "Content-Type": "application/json"},
            )
            for item in resp.json().get("value", []):
                results[item["id"]] = WorkItemData(
                    id=item["id"],
                    rev=item.get("rev", 0),
                    fields=item.get("fields", {}),
                )

        return results

    def patch_work_item(
        self, work_item_id: int, patch_ops: List[Dict[str, Any]]
    ) -> WorkItemData:
        params = f"api-version={self._api_version}"
        if self._suppress_notifications:
            params += "&suppressNotifications=true"
        url = f"{self._base_url}/wit/workitems/{work_item_id}?{params}"
        resp = self._request_with_retry(
            "PATCH",
            url,
            json=patch_ops,
            headers={
                **self._auth_headers,
                "Content-Type": "application/json-patch+json",
            },
        )
        data = resp.json()
        return WorkItemData(
            id=data["id"],
            rev=data.get("rev", 0),
            fields=data.get("fields", {}),
        )

    def get_child_work_items(
        self, parent_work_item_id: int, fields: List[str]
    ) -> List[WorkItemData]:
        url = (
            f"{self._base_url}/wit/workitems/{parent_work_item_id}"
            f"?%24expand=Relations&api-version={self._api_version}"
        )
        resp = self._request_with_retry(
            "GET",
            url,
            headers={**self._auth_headers, "Content-Type": "application/json"},
        )
        child_ids: List[int] = []
        for relation in resp.json().get("relations", []) or []:
            if relation.get("rel") != "System.LinkTypes.Hierarchy-Forward":
                continue
            match = re.search(r"/workItems/(\d+)$", relation.get("url", ""))
            if match:
                child_ids.append(int(match.group(1)))

        if not child_ids:
            return []

        child_items = self.get_work_items_batch(child_ids, fields)
        return [child_items[child_id] for child_id in child_ids if child_id in child_items]

    def search_users(self, query: str) -> List[Dict[str, Any]]:
        params = urlencode(
            {
                "searchFilter": "General",
                "filterValue": query,
                "queryMembership": "None",
                "api-version": self._api_version,
            }
        )
        url = f"https://vssps.dev.azure.com/{self._organization}/_apis/identities?{params}"
        resp = self._request_with_retry(
            "GET",
            url,
            headers={**self._auth_headers, "Content-Type": "application/json"},
        )
        return resp.json().get("value", [])


class AzureDevOpsMockClient(AzureDevOpsClientBase):
    """In-memory stub for development and unit testing.

    Work items that do not exist in the store are auto-created with empty
    fields on first access, mirroring the behaviour of the real API when the
    Work Item exists but has no value for the requested field.

    Call ``set_item()`` in test setup to pre-populate specific work items.
    """

    def __init__(
        self, initial_items: Optional[Dict[int, Dict[str, Any]]] = None
    ) -> None:
        self._fields: Dict[int, Dict[str, Any]] = {}
        self._revs: Dict[int, int] = {}
        self._children: Dict[int, List[int]] = {}
        if initial_items:
            for wid, f in initial_items.items():
                self._fields[wid] = dict(f)
                self._revs[wid] = 1

    # --- test helpers ---

    def set_item(
        self, work_item_id: int, fields: Dict[str, Any], rev: int = 1
    ) -> None:
        self._fields[work_item_id] = dict(fields)
        self._revs[work_item_id] = rev

    def get_stored_fields(self, work_item_id: int) -> Dict[str, Any]:
        return dict(self._fields.get(work_item_id, {}))

    def set_children(self, parent_work_item_id: int, child_work_item_ids: List[int]) -> None:
        self._children[parent_work_item_id] = list(child_work_item_ids)

    # --- client interface ---

    def get_work_items_batch(
        self, work_item_ids: List[int], fields: List[str]
    ) -> Dict[int, WorkItemData]:
        results: Dict[int, WorkItemData] = {}
        for wid in work_item_ids:
            if wid not in self._fields:
                self._fields[wid] = {}
                self._revs[wid] = 1
            item_fields = {f: self._fields[wid].get(f) for f in fields}
            results[wid] = WorkItemData(
                id=wid, rev=self._revs[wid], fields=item_fields
            )
        return results

    def patch_work_item(
        self, work_item_id: int, patch_ops: List[Dict[str, Any]]
    ) -> WorkItemData:
        if work_item_id not in self._fields:
            self._fields[work_item_id] = {}
            self._revs[work_item_id] = 0

        for op in patch_ops:
            if op.get("op") == "add":
                path: str = op.get("path", "")
                if path.startswith("/fields/"):
                    field_name = path[len("/fields/"):]
                    self._fields[work_item_id][field_name] = op.get("value")

        self._revs[work_item_id] += 1
        return WorkItemData(
            id=work_item_id,
            rev=self._revs[work_item_id],
            fields=dict(self._fields[work_item_id]),
        )

    def get_child_work_items(
        self, parent_work_item_id: int, fields: List[str]
    ) -> List[WorkItemData]:
        child_ids = self._children.get(parent_work_item_id, [])
        if not child_ids:
            child_ids = [parent_work_item_id * 100 + i for i in range(1, 4)]
            self._children[parent_work_item_id] = child_ids
            for index, child_id in enumerate(child_ids, start=1):
                if child_id not in self._fields:
                    self._fields[child_id] = {
                        "System.Title": f"Mock child work item {index} for #{parent_work_item_id}",
                        "System.WorkItemType": "Task",
                        "System.State": "New",
                    }
                    self._revs[child_id] = 1

        child_items = self.get_work_items_batch(child_ids, fields)
        return [child_items[child_id] for child_id in child_ids if child_id in child_items]

    def search_users(self, query: str) -> List[Dict[str, Any]]:
        names = [
            "Aoi Tanaka",
            "Haruto Sato",
            "Yui Suzuki",
            "Ren Takahashi",
            "Sakura Ito",
            "Minato Watanabe",
            "Hina Yamamoto",
            "Sota Nakamura",
            "Mei Kobayashi",
            "Riku Kato",
            "Mio Yoshida",
            "Yuto Yamada",
            "Akari Sasaki",
            "Kaito Yamaguchi",
            "Rin Matsumoto",
            "Hinata Inoue",
            "Yuna Kimura",
            "Daichi Hayashi",
            "Nana Shimizu",
            "Toma Saito",
        ]
        normalized = query.strip().lower()
        return [
            {
                "descriptor": f"mock.user.{index}",
                "displayName": name,
                "principalName": f"{name.lower().replace(' ', '.')}@example.com",
                "mailAddress": f"{name.lower().replace(' ', '.')}@example.com",
            }
            for index, name in enumerate(names, start=1)
            if (
                normalized in name.lower()
                or normalized in f"{name.lower().replace(' ', '.')}@example.com"
            )
        ]


def create_client(settings) -> AzureDevOpsClientBase:
    """Factory: returns the appropriate client based on settings."""
    if settings.use_mock:
        return AzureDevOpsMockClient()
    return AzureDevOpsHttpClient(
        organization=settings.organization,
        pat=settings.pat,
        project=settings.project,  # 空文字の場合は org レベル URL が使われる
        api_version=settings.api_version,
        timeout=settings.request_timeout_seconds,
        suppress_notifications=settings.suppress_notifications,
    )
