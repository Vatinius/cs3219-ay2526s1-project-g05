export class OperationTransformer {
  transform(incomingOperation, history, baseVersion) {
    if (!incomingOperation || typeof incomingOperation.index !== "number") {
      throw new Error("Invalid operation supplied");
    }

    const transformedOperation = { ...incomingOperation };
    const appliedOperations = history.slice(baseVersion);

    for (const operation of appliedOperations) {
      if (!operation) {
        continue;
      }

      if (operation.type === "insert") {
        this.#handleInsert(operation, transformedOperation);
      } else if (operation.type === "delete") {
        this.#handleDelete(operation, transformedOperation);
      }
    }

    return transformedOperation;
  }

  #handleInsert(appliedOperation, incomingOperation) {
    if (appliedOperation.index < incomingOperation.index) {
      incomingOperation.index += appliedOperation.text.length;
    }
  }

  #handleDelete(appliedOperation, incomingOperation) {
    const deleteStart = appliedOperation.index;
    const deleteEnd = appliedOperation.index + appliedOperation.length;

    if (deleteEnd <= incomingOperation.index) {
      incomingOperation.index -= appliedOperation.length;
      return;
    }

    if (deleteStart < incomingOperation.index && deleteEnd > incomingOperation.index) {
      // If the delete overlaps the incoming index, clamp the index to the start of the delete.
      incomingOperation.index = deleteStart;
    }
  }
}
