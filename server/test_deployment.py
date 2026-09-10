from verify_revision import inspect


def service():
    return {"spec": {"template": {"spec": {"containers": [{"image": "image:expected", "env": [{"value": "private-secret"}]}]}}},
            "status": {"latestCreatedRevisionName": "new", "latestReadyRevisionName": "new",
                       "traffic": [{"revisionName": "new", "percent": 100}]}}


def test_ready_image_and_traffic_are_all_required():
    value = service()
    assert inspect(value, "image:expected")["failures"] == []
    value["status"]["latestReadyRevisionName"] = "different"
    value["status"]["traffic"][0]["percent"] = 0
    report = inspect(value, "image:other")
    assert report["failures"] == ["REVISION_NOT_READY", "IMAGE_MISMATCH", "TRAFFIC_MISMATCH"]
    assert "private-secret" not in str(report)
    assert inspect({}, "image:expected")["failures"] == report["failures"]
